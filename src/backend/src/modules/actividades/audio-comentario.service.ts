import {
  BadRequestException,
  Catch,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AlmacenamientoService } from '../../infra/almacenamiento/almacenamiento.service';
import { UsuarioActual } from '../../common/usuario-actual.decorator';
import { filtroActividadOrganizacion } from '../../common/organizacion';
import { ErroresSubidaFilter } from '../evidencias/errores-subida.filter';

export const AUDIO_MAXIMO_MB = 10;
/** Tope de duracion de un comentario de voz (el navegador corta la grabacion ahi). */
export const AUDIO_MAXIMO_SEGUNDOS = 300;

export const OPCIONES_SUBIDA_AUDIO: MulterOptions = {
  limits: { fileSize: AUDIO_MAXIMO_MB * 1024 * 1024, files: 1, fields: 2, fieldSize: 32, parts: 3 },
};

@Catch(HttpException)
export class ErroresAudioFilter extends ErroresSubidaFilter {
  protected readonly limiteMb = AUDIO_MAXIMO_MB;
}

/**
 * Formatos que producen los navegadores al grabar con MediaRecorder: WebM/Opus
 * (Chrome, Edge, Firefox, Android), MP4/AAC (Safari, iPhone) y Ogg. Se
 * reconocen por su firma, no por lo que declara el navegador.
 */
const FIRMAS: { tipo: string; coincide: (b: Buffer) => boolean }[] = [
  { tipo: 'audio/webm', coincide: (b) => b.length > 4 && b.readUInt32BE(0) === 0x1a45dfa3 },
  { tipo: 'audio/mp4', coincide: (b) => b.length > 12 && b.toString('ascii', 4, 8) === 'ftyp' },
  { tipo: 'audio/ogg', coincide: (b) => b.length > 4 && b.toString('ascii', 0, 4) === 'OggS' },
];

const clave = (actividadId: string, version: string) => `audios-comentario/${actividadId}/${version}`;

/** Igual que las instrucciones: quien creo la tarea o un administrador. */
function puedeEditar(u: UsuarioActual, creadoPorId: string | null) {
  return (creadoPorId !== null && creadoPorId === u.id) || u.rol === 'ADMINISTRADOR';
}

/**
 * Comentario de voz de una tarea: un audio grabado con el microfono que
 * acompana al texto de comentarios. Lo graba o quita quien puede editar los
 * comentarios; lo escucha cualquiera que vea la tarea.
 */
@Injectable()
export class AudioComentarioService {
  private readonly registro = new Logger(AudioComentarioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly almacenamiento: AlmacenamientoService,
  ) {}

  async subir(id: string, u: UsuarioActual, archivo: Express.Multer.File | undefined, segundosCrudos?: string) {
    const actividad = await this.editable(id, u);
    if (!archivo?.buffer?.length) throw new BadRequestException('Adjunta la grabacion.');
    const tipo = FIRMAS.find((f) => f.coincide(archivo.buffer))?.tipo;
    if (!tipo) throw new BadRequestException('El audio debe ser una grabacion WebM, MP4 u Ogg.');

    const segundos = Math.round(Number(segundosCrudos));
    const duracion =
      Number.isFinite(segundos) && segundos > 0 ? Math.min(segundos, AUDIO_MAXIMO_SEGUNDOS) : null;

    const version = randomUUID();
    await this.almacenamiento.subir(clave(id, version), archivo.buffer, tipo);

    await this.prisma.$transaction(async (tx) => {
      await tx.actividad.update({
        where: { id },
        data: { audioComentario: version, audioComentarioSegundos: duracion },
      });
      await tx.registroAuditoria.create({
        data: {
          actorId: u.id,
          organizacionId: actividad.proyecto.organizacionId,
          accion: 'ACTIVIDAD_AUDIO_COMENTARIO',
          tipoEntidad: 'Actividad',
          entidadId: id,
          valorAnterior: { audioComentario: actividad.audioComentario },
          valorNuevo: { audioComentario: version, segundos: duracion },
        },
      });
    });
    if (actividad.audioComentario) await this.borrarArchivo(id, actividad.audioComentario);

    return { audioComentario: version, audioComentarioSegundos: duracion };
  }

  async quitar(id: string, u: UsuarioActual) {
    const actividad = await this.editable(id, u);
    if (!actividad.audioComentario) return { audioComentario: null, audioComentarioSegundos: null };

    await this.prisma.$transaction(async (tx) => {
      await tx.actividad.update({
        where: { id },
        data: { audioComentario: null, audioComentarioSegundos: null },
      });
      await tx.registroAuditoria.create({
        data: {
          actorId: u.id,
          organizacionId: actividad.proyecto.organizacionId,
          accion: 'ACTIVIDAD_AUDIO_COMENTARIO',
          tipoEntidad: 'Actividad',
          entidadId: id,
          valorAnterior: { audioComentario: actividad.audioComentario },
          valorNuevo: { audioComentario: null },
        },
      });
    });
    await this.borrarArchivo(id, actividad.audioComentario);
    return { audioComentario: null, audioComentarioSegundos: null };
  }

  /** El audio, para quien puede ver la tarea (misma empresa). */
  async obtener(id: string, u: UsuarioActual) {
    const actividad = await this.prisma.actividad.findFirst({
      where: { id, eliminadoEn: null, ...filtroActividadOrganizacion(u) },
      select: { audioComentario: true },
    });
    if (!actividad?.audioComentario) throw new NotFoundException('La tarea no tiene comentario de voz.');

    const { flujo, tipoMime, tamanoBytes } = await this.almacenamiento.descargar(
      clave(id, actividad.audioComentario),
    );
    const tipo = FIRMAS.some((f) => f.tipo === tipoMime) ? tipoMime! : 'application/octet-stream';
    return { flujo, tipo, tamanoBytes };
  }

  private async editable(id: string, u: UsuarioActual) {
    const actividad = await this.prisma.actividad.findFirst({
      where: { id, eliminadoEn: null, ...filtroActividadOrganizacion(u) },
      select: {
        creadoPorId: true,
        audioComentario: true,
        proyecto: { select: { organizacionId: true } },
      },
    });
    if (!actividad) throw new NotFoundException('La actividad no existe.');
    if (!puedeEditar(u, actividad.creadoPorId)) {
      throw new ForbiddenException('Solo quien creo la tarea o un administrador pueden editar sus comentarios.');
    }
    return actividad;
  }

  /** Borrar el audio anterior es limpieza: si falla, el cambio ya quedo guardado. */
  private async borrarArchivo(id: string, version: string) {
    try {
      await this.almacenamiento.eliminar(clave(id, version));
    } catch (error) {
      this.registro.warn(`No se pudo borrar un comentario de voz anterior: ${(error as Error).message}`);
    }
  }
}
