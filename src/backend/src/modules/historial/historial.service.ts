import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { exigirOrganizacion } from '../../common/organizacion';
import { UsuarioActual } from '../../common/usuario-actual.decorator';
import { ConsultarHistorialDto } from './dto/consultar-historial.dto';

/**
 * US-08 — consulta filtrada y paginada de la bitacora de auditoria.
 *
 * El aislamiento Multi-SaaS se aplica siempre: cualquier usuario que no sea
 * SUPER_ADMIN queda acotado a su propia organizacion.
 */
@Injectable()
export class HistorialService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(u: UsuarioActual, q: ConsultarHistorialDto) {
    const pagina = Math.max(1, q.pagina ?? 1);
    const limite = Math.min(50, Math.max(1, q.limite ?? 25));
    const saltar = (pagina - 1) * limite;

    const organizacionId =
      u.rol === 'SUPER_ADMIN'
        ? q.organizacionId?.trim() || undefined
        : exigirOrganizacion(u);

    const busqueda = q.busqueda?.trim();
    const where: Prisma.RegistroAuditoriaWhereInput = {
      ...(organizacionId ? { organizacionId } : {}),
      ...(q.tipoEntidad?.trim() ? { tipoEntidad: q.tipoEntidad.trim() } : {}),
      ...(q.accion?.trim()
        ? { accion: { contains: q.accion.trim(), mode: 'insensitive' } }
        : {}),
      ...(busqueda
        ? {
            OR: [
              { accion: { contains: busqueda, mode: 'insensitive' } },
              { tipoEntidad: { contains: busqueda, mode: 'insensitive' } },
              { actor: { nombreCompleto: { contains: busqueda, mode: 'insensitive' } } },
              { actor: { email: { contains: busqueda, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.registroAuditoria.findMany({
        where,
        orderBy: { ocurridoEn: 'desc' },
        skip: saltar,
        take: limite,
        select: {
          id: true,
          accion: true,
          tipoEntidad: true,
          entidadId: true,
          valorAnterior: true,
          valorNuevo: true,
          ocurridoEn: true,
          actor: {
            select: {
              id: true,
              nombreCompleto: true,
              email: true,
              rol: true,
            },
          },
          organizacion: {
            select: { nombre: true },
          },
        },
      }),
      this.prisma.registroAuditoria.count({ where }),
    ]);

    return {
      items,
      total,
      pagina,
      limite,
      totalPaginas: Math.max(1, Math.ceil(total / limite)),
    };
  }
}
