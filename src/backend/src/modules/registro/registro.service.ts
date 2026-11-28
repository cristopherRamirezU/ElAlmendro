import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PlanSaaS } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { LimiteIntentosService, REGLAS } from '../../common/seguridad/limite-intentos.service';
import { problemaContrasena } from '../../common/seguridad/politica-contrasena';
import { normalizarCorreo } from '../../common/organizacion';
import { VERSION_POLITICAS } from '../../common/politicas';
import { OrganizacionesService } from '../organizaciones/organizaciones.service';
import { RegistroDto } from './dto/registro.dto';

/** Limites del plan Basico (el plan GRATIS de la base). */
export const PLAN_BASICO = { plan: PlanSaaS.GRATIS, maxUsuarios: 10, maxProyectos: 5 } as const;

/** "Panaderia Ñuñoa Ltda." -> "panaderia-nunoa-ltda". */
export function slugDesde(nombre: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
  return base || 'empresa';
}

/**
 * Registro publico desde la pagina web: crea la empresa con el plan Basico
 * y deja a quien se registra como su administrador. Despues entra por el
 * login de siempre.
 */
@Injectable()
export class RegistroService {
  private readonly registro = new Logger(RegistroService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizaciones: OrganizacionesService,
    private readonly limites: LimiteIntentosService,
  ) {}

  async registrar(dto: RegistroDto, ip?: string) {
    // Cada intento cuenta, salga bien o mal: crear empresas en serie desde
    // una IP es abuso aunque cada una sea valida.
    this.limites.consumir(`registro:ip:${ip || 'desconocida'}`, REGLAS.registroIp);

    // El campo trampa lleno delata a un programa. Se responde con un error
    // generico para no ensenarle que lo detectamos.
    if (dto.sitioWeb?.trim()) {
      throw new BadRequestException('No se pudo completar el registro.');
    }

    const correo = normalizarCorreo(dto.correo);
    const problema = problemaContrasena(dto.contrasena, correo);
    if (problema) throw new BadRequestException(problema);

    const org = await this.organizaciones.crear({
      nombre: dto.empresa.trim(),
      slug: await this.slugLibre(dto.empresa),
      rut: dto.rut?.trim() || undefined,
      ...PLAN_BASICO,
      adminEmail: correo,
      adminNombre: dto.nombre.trim(),
      adminPassword: dto.contrasena,
    });

    // En el formulario acepto los terminos y la politica vigentes: queda
    // registrado para que la app no se los vuelva a pedir al entrar.
    await this.prisma.usuario.update({
      where: { email: correo },
      data: { politicasVersion: VERSION_POLITICAS, politicasAceptadasEn: new Date() },
    });

    try {
      await this.prisma.registroAuditoria.create({
        data: {
          organizacionId: org.id,
          accion: 'REGISTRO_PUBLICO',
          tipoEntidad: 'Organizacion',
          entidadId: org.id,
          valorNuevo: { empresa: org.nombre, correo, plan: org.plan, politicasAceptadas: VERSION_POLITICAS },
          direccionIp: ip ?? null,
        },
      });
    } catch (error) {
      // La empresa ya quedo creada: la auditoria no debe deshacer el registro.
      this.registro.warn(`No se pudo auditar un registro publico: ${(error as Error).message}`);
    }

    return { empresa: org.nombre, correo, plan: org.plan };
  }

  /** Identificador unico de la empresa: el nombre, con un sufijo si ya existe. */
  private async slugLibre(nombre: string): Promise<string> {
    const base = slugDesde(nombre);
    for (let intento = 0; intento < 6; intento++) {
      const slug = intento === 0 ? base : `${base.slice(0, 50)}-${randomBytes(3).toString('hex')}`;
      const existe = await this.prisma.organizacion.findUnique({ where: { slug }, select: { id: true } });
      if (!existe) return slug;
    }
    return `${base.slice(0, 40)}-${randomBytes(6).toString('hex')}`;
  }
}
