import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { UsuarioActual } from '../../common/usuario-actual.decorator';
import { exigirOrganizacion } from '../../common/organizacion';
import { ChatGateway } from './chat.gateway';
import { EnviarMensajeDto } from './dto/enviar-mensaje.dto';
import { CANAL_GENERAL, ListarMensajesDto } from './dto/listar-mensajes.dto';

const SELECCION_MENSAJE = {
  id: true,
  emisorId: true,
  receptorId: true,
  cuerpo: true,
  creadoEn: true,
  leidoEn: true,
  emisor: { select: { id: true, nombreCompleto: true } },
} satisfies Prisma.MensajeChatSelect;

interface UltimoMensajeFila {
  contraparte: string;
  cuerpo: string;
  creadoEn: Date;
  emisorId: string;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ChatGateway,
  ) {}

  /**
   * Nomina para la lista de contactos: todos los usuarios activos menos uno
   * mismo, con su presencia, cuantos mensajes le deben lectura y el ultimo
   * mensaje cruzado. El chat es entre companeros de equipo: aqui no aplica
   * la restriccion de `usuarios/trabajadores`, que existe para los reportes.
   */
  async contactos(yo: UsuarioActual) {
    // El chat es siempre interno de una empresa: sin organizacion no hay chat.
    const orgId = exigirOrganizacion(yo);
    const whereOrg = { organizacionId: orgId };
    const [usuarios, pendientes, ultimos, ultimoGeneral] = await Promise.all([
      this.prisma.usuario.findMany({
        where: { activo: true, id: { not: yo.id }, ...whereOrg },
        select: { id: true, nombreCompleto: true, rol: true, email: true },
        orderBy: { nombreCompleto: 'asc' },
      }),
      this.prisma.mensajeChat.groupBy({
        by: ['emisorId'],
        where: { receptorId: yo.id, leidoEn: null, ...whereOrg },
        _count: { _all: true },
      }),
      // Ultimo mensaje por contraparte, en una sola consulta.
      this.prisma.$queryRaw<UltimoMensajeFila[]>`
        SELECT DISTINCT ON (contraparte) contraparte, cuerpo, "creadoEn", "emisorId"
        FROM (
          SELECT CASE WHEN "emisorId" = ${yo.id}::uuid THEN "receptorId" ELSE "emisorId" END AS contraparte,
                 cuerpo, "creadoEn", "emisorId"
          FROM "mensajes_chat"
          WHERE "receptorId" IS NOT NULL
            AND "organizacionId" = ${orgId}::uuid
            AND (${yo.id}::uuid = "emisorId" OR ${yo.id}::uuid = "receptorId")
        ) t
        ORDER BY contraparte, "creadoEn" DESC
      `,
      this.prisma.mensajeChat.findFirst({
        where: { receptorId: null, ...whereOrg },
        orderBy: { creadoEn: 'desc' },
        select: { cuerpo: true, creadoEn: true, emisorId: true },
      }),
    ]);

    const noLeidos = new Map(pendientes.map((p) => [p.emisorId, p._count._all]));
    const ultimoPor = new Map(ultimos.map((u) => [u.contraparte, u]));

    return {
      general: {
        ultimoMensaje: ultimoGeneral
          ? { ...ultimoGeneral, propio: ultimoGeneral.emisorId === yo.id }
          : null,
      },
      contactos: usuarios.map((u) => {
        const ultimo = ultimoPor.get(u.id);
        return {
          ...u,
          enLinea: this.gateway.estaEnLinea(u.id),
          noLeidos: noLeidos.get(u.id) ?? 0,
          ultimoMensaje: ultimo
            ? { cuerpo: ultimo.cuerpo, creadoEn: ultimo.creadoEn, propio: ultimo.emisorId === yo.id }
            : null,
        };
      }),
    };
  }

  /** Historial de una conversacion, del mas antiguo al mas nuevo, paginado hacia atras. */
  async mensajes(yo: UsuarioActual, dto: ListarMensajesDto) {
    const limite = dto.limite ?? 50;
    const cursor = dto.antes ? { creadoEn: { lt: new Date(dto.antes) } } : {};
    const whereOrg = { organizacionId: exigirOrganizacion(yo) };

    const filtro: Prisma.MensajeChatWhereInput =
      dto.con === CANAL_GENERAL
        ? { receptorId: null, ...whereOrg, ...cursor }
        : {
            ...whereOrg,
            OR: [
              { emisorId: yo.id, receptorId: dto.con },
              { emisorId: dto.con, receptorId: yo.id },
            ],
            ...cursor,
          };

    const filas = await this.prisma.mensajeChat.findMany({
      where: filtro,
      select: SELECCION_MENSAJE,
      orderBy: { creadoEn: 'desc' },
      take: limite + 1,
    });

    const hayMas = filas.length > limite;
    const pagina = (hayMas ? filas.slice(0, limite) : filas).reverse();
    return { mensajes: pagina, hayMas };
  }

  async enviar(yo: UsuarioActual, dto: EnviarMensajeDto) {
    const cuerpo = dto.cuerpo.trim();
    if (!cuerpo) throw new BadRequestException('El mensaje no puede estar vacio.');

    const orgId = exigirOrganizacion(yo);

    if (dto.receptorId) {
      if (dto.receptorId === yo.id) {
        throw new BadRequestException('No puedes enviarte mensajes a ti mismo.');
      }
      const receptor = await this.prisma.usuario.findFirst({
        where: { id: dto.receptorId, activo: true, organizacionId: orgId },
        select: { id: true },
      });
      if (!receptor) throw new NotFoundException('El destinatario no existe o no pertenece a tu organización.');
    }

    const mensaje = await this.prisma.mensajeChat.create({
      data: {
        emisorId: yo.id,
        receptorId: dto.receptorId ?? null,
        organizacionId: orgId,
        cuerpo,
      },
      select: SELECCION_MENSAJE,
    });

    this.gateway.emitirMensaje(mensaje, orgId);
    return mensaje;
  }

  /** Marca como leidos todos los mensajes privados que `emisorId` me envio. */
  async marcarLeidos(yo: UsuarioActual, emisorId: string) {
    const { count } = await this.prisma.mensajeChat.updateMany({
      where: { emisorId, receptorId: yo.id, leidoEn: null, organizacionId: exigirOrganizacion(yo) },
      data: { leidoEn: new Date() },
    });
    if (count > 0) this.gateway.emitirLectura(emisorId, yo.id);
    return { marcados: count };
  }

  /** Total de mensajes privados sin leer, para la insignia del menu. */
  async noLeidos(yo: UsuarioActual) {
    const total = await this.prisma.mensajeChat.count({
      where: { receptorId: yo.id, leidoEn: null, organizacionId: exigirOrganizacion(yo) },
    });
    return { total };
  }
}
