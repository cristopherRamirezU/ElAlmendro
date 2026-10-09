import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AlmacenamientoService } from '../../infra/almacenamiento/almacenamiento.service';
import { UsuarioActual } from '../../common/usuario-actual.decorator';
import {
  asegurarMismaOrganizacion,
  exigirOrganizacion,
  filtroActividadOrganizacion,
} from '../../common/organizacion';

const TAMANO_MAXIMO_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Un adjunto lo puede eliminar quien lo subio o el administrador de la
 * organizacion, y nunca si la tarea ya esta completada: ese archivo es el
 * respaldo con que se cerro.
 */
function puedeEliminar(u: UsuarioActual, subidaPorId: string, estadoActividad?: string | null) {
  if (estadoActividad === 'COMPLETADA') return false;
  return subidaPorId === u.id || u.rol === 'ADMINISTRADOR';
}

/** US — evidencias adjuntas a una tarea (documentos, capturas, etc). */
@Injectable()
export class EvidenciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly almacenamiento: AlmacenamientoService,
  ) {}

  async listar(u: UsuarioActual, actividadId: string) {
    const evidencias = await this.prisma.evidencia.findMany({
      where: { actividadId, eliminadaEn: null, actividad: filtroActividadOrganizacion(u) },
      orderBy: { subidaEn: 'desc' },
      select: {
        id: true,
        nombreArchivo: true,
        tipoMime: true,
        tamanoBytes: true,
        subidaEn: true,
        subidaPorId: true,
        subidaPor: { select: { nombreCompleto: true } },
        actividad: { select: { estado: true } },
      },
    });
    return evidencias.map(({ subidaPorId, actividad, ...ev }) => ({
      ...ev,
      puedeEliminar: puedeEliminar(u, subidaPorId, actividad?.estado),
    }));
  }

  async subir(u: UsuarioActual, actividadId: string, archivo: Express.Multer.File) {
    const organizacionId = exigirOrganizacion(u);
    if (!archivo) throw new BadRequestException('No se recibio ningun archivo.');
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      throw new BadRequestException('El archivo supera el limite de 25 MB.');
    }

    const actividad = await this.prisma.actividad.findFirst({
      where: { id: actividadId, eliminadoEn: null, proyecto: { organizacionId } },
      select: { id: true, estado: true },
    });
    if (!actividad) throw new NotFoundException('La actividad no existe.');
    if (actividad.estado === 'COMPLETADA') {
      throw new BadRequestException(
        'La tarea ya esta completada: no se pueden adjuntar mas archivos.',
      );
    }

    const sha256 = createHash('sha256').update(archivo.buffer).digest('hex');
    // Prefijo por organizacion: los archivos de cada empresa quedan separados
    // tambien en el bucket, no solo en la base.
    const clave = `organizaciones/${organizacionId}/evidencias/${actividadId}/${randomUUID()}-${archivo.originalname}`;

    await this.almacenamiento.subir(clave, archivo.buffer, archivo.mimetype);

    // Quien lo acaba de subir siempre puede eliminarlo (la tarea sigue abierta).
    const evidencia = await this.prisma.evidencia.create({
      data: {
        actividadId,
        subidaPorId: u.id,
        claveObjeto: clave,
        nombreArchivo: archivo.originalname,
        tipoMime: archivo.mimetype,
        tamanoBytes: archivo.size,
        sha256,
      },
      select: {
        id: true,
        nombreArchivo: true,
        tipoMime: true,
        tamanoBytes: true,
        subidaEn: true,
        subidaPor: { select: { nombreCompleto: true } },
      },
    });
    return { ...evidencia, puedeEliminar: true };
  }

  /**
   * Quita un adjunto de la tarea. Es un borrado logico: la base prohibe
   * eliminar evidencias, que deben quedar disponibles para revision, asi que
   * el registro y el archivo se conservan. El adjunto deja de listarse, de
   * descargarse y de contar como respaldo para completar la tarea.
   */
  async eliminar(u: UsuarioActual, id: string) {
    const evidencia = await this.prisma.evidencia.findUnique({
      where: { id },
      select: {
        id: true,
        nombreArchivo: true,
        subidaPorId: true,
        eliminadaEn: true,
        actividad: {
          select: { id: true, estado: true, proyecto: { select: { organizacionId: true } } },
        },
        sesion: {
          select: {
            actividad: {
              select: { id: true, estado: true, proyecto: { select: { organizacionId: true } } },
            },
          },
        },
      },
    });
    if (!evidencia || evidencia.eliminadaEn) throw new NotFoundException('El archivo no existe.');

    const actividad = evidencia.actividad ?? evidencia.sesion?.actividad;
    asegurarMismaOrganizacion(u, actividad?.proyecto.organizacionId, 'El archivo no existe.');
    if (actividad?.estado === 'COMPLETADA') {
      throw new BadRequestException(
        'La tarea ya esta completada: sus archivos adjuntos no se pueden eliminar.',
      );
    }
    if (!puedeEliminar(u, evidencia.subidaPorId, actividad?.estado)) {
      throw new ForbiddenException(
        'Solo quien subio el archivo o un administrador pueden eliminarlo.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.evidencia.update({
        where: { id },
        data: { eliminadaEn: new Date(), eliminadaPorId: u.id },
      });
      await tx.registroAuditoria.create({
        data: {
          actorId: u.id,
          organizacionId: actividad!.proyecto.organizacionId,
          accion: 'EVIDENCIA_ELIMINADA',
          tipoEntidad: 'Evidencia',
          entidadId: id,
          valorAnterior: {
            nombreArchivo: evidencia.nombreArchivo,
            actividadId: actividad!.id,
            subidaPorId: evidencia.subidaPorId,
          },
        },
      });
    });

    return { ok: true };
  }

  async obtenerParaDescarga(u: UsuarioActual, id: string) {
    const evidencia = await this.prisma.evidencia.findUnique({
      where: { id },
      include: {
        actividad: { select: { proyecto: { select: { organizacionId: true } } } },
        sesion: {
          select: { actividad: { select: { proyecto: { select: { organizacionId: true } } } } },
        },
      },
    });
    // Un adjunto quitado ya no se sirve, aunque alguien conserve el enlace.
    if (!evidencia || evidencia.eliminadaEn) throw new NotFoundException('La evidencia no existe.');

    const organizacionEvidencia =
      evidencia.actividad?.proyecto.organizacionId ??
      evidencia.sesion?.actividad.proyecto.organizacionId;
    asegurarMismaOrganizacion(u, organizacionEvidencia, 'La evidencia no existe.');

    const { flujo } = await this.almacenamiento.descargar(evidencia.claveObjeto);
    return { flujo, evidencia };
  }
}
