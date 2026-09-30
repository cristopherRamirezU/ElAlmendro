import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

/** US — evidencias adjuntas a una tarea (documentos, capturas, etc). */
@Injectable()
export class EvidenciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly almacenamiento: AlmacenamientoService,
  ) {}

  async listar(u: UsuarioActual, actividadId: string) {
    return this.prisma.evidencia.findMany({
      where: { actividadId, actividad: filtroActividadOrganizacion(u) },
      orderBy: { subidaEn: 'desc' },
      select: {
        id: true,
        nombreArchivo: true,
        tipoMime: true,
        tamanoBytes: true,
        subidaEn: true,
        subidaPor: { select: { nombreCompleto: true } },
      },
    });
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

    return this.prisma.evidencia.create({
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
    if (!evidencia) throw new NotFoundException('La evidencia no existe.');

    const organizacionEvidencia =
      evidencia.actividad?.proyecto.organizacionId ??
      evidencia.sesion?.actividad.proyecto.organizacionId;
    asegurarMismaOrganizacion(u, organizacionEvidencia, 'La evidencia no existe.');

    const { flujo } = await this.almacenamiento.descargar(evidencia.claveObjeto);
    return { flujo, evidencia };
  }
}
