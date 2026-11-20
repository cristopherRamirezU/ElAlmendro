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

/** Datos de la tarea que deciden quien graba y quien borra. */
interface Tarea {
  creadoPorId: string | null;
  responsableId: string;
  proyecto: { organizacionId: string };
}

/**
 * Graba quien trabaja la tarea: su responsable (el trabajador), quien la creo
 * y quien la gestiona (administrador o supervisor).
 */
export function puedeGrabarAudio(u: UsuarioActual, t: Pick<Tarea, 'creadoPorId' | 'responsableId'>) {
  return (
    t.responsableId === u.id ||
    (t.creadoPorId !== null && t.creadoPorId === u.id) ||
    u.rol === 'ADMINISTRADOR' ||
    u.rol === 'SUPERVISOR'
  );
}

/** Un audio lo borra quien lo grabo o un administrador. */
export function puedeEliminarAudio(u: UsuarioActual, autorId: string) {
  return autorId === u.id || u.rol === 'ADMINISTRADOR';
}

const SELECCION = {
  id: true,
  segundos: true,
  creadoEn: true,
  autor: { select: { id: true, nombreCompleto: true } },
} as const;

/**
 * Comentarios de voz de una tarea: audios grabados con el microfono que
 * acompanan al texto de comentarios. Cada persona agrega los suyos; todos los
 * que ven la tarea los escuchan.
 */
@Injectable()
export class AudioComentarioService {
  private readonly registro = new Logger(AudioComentarioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly almacenamiento: AlmacenamientoService,
  ) {}

  /** Lista de la tarea, de la mas antigua a la mas nueva, con lo que cada quien puede hacer. */
  async listar(actividadId: string, u: UsuarioActual) {
    const audios = await this.prisma.audioComentario.findMany({
      where: { actividadId },
      orderBy: { creadoEn: 'asc' },
      select: SELECCION,
    });
    return audios.map((a) => ({ ...a, puedeEliminar: puedeEliminarAudio(u, a.autor.id) }));
  }

  async subir(id: string, u: UsuarioActual, archivo: Express.Multer.File | undefined, segundosCrudos?: string) {
    const tarea = await this.tarea(id, u);
    if (!puedeGrabarAudio(u, tarea)) {
      throw new ForbiddenException('Solo quien trabaja en la tarea puede grabarle comentarios de voz.');
    }
    if (!archivo?.buffer?.length) throw new BadRequestException('Adjunta la grabacion.');
    const tipo = FIRMAS.find((f) => f.coincide(archivo.buffer))?.tipo;
    if (!tipo) throw new BadRequestException('El audio debe ser una grabacion WebM, MP4 u Ogg.');

    const segundos = Math.round(Number(segundosCrudos));
    const duracion =
      Number.isFinite(segundos) && segundos > 0 ? Math.min(segundos, AUDIO_MAXIMO_SEGUNDOS) : null;

    const claveObjeto = `audios-comentario/${id}/${randomUUID()}`;
    await this.almacenamiento.subir(claveObjeto, archivo.buffer, tipo);

    const audio = await this.prisma.$transaction(async (tx) => {
      const nuevo = await tx.audioComentario.create({
        data: { actividadId: id, autorId: u.id, claveObjeto, tipoMime: tipo, segundos: duracion },
        select: SELECCION,
      });
      await tx.registroAuditoria.create({
        data: {
          actorId: u.id,
          organizacionId: tarea.proyecto.organizacionId,
          accion: 'ACTIVIDAD_AUDIO_AGREGADO',
          tipoEntidad: 'Actividad',
          entidadId: id,
          valorNuevo: { audioId: nuevo.id, segundos: duracion },
        },
      });
      return nuevo;
    });

    return { ...audio, puedeEliminar: true };
  }

  async quitar(id: string, audioId: string, u: UsuarioActual) {
    const tarea = await this.tarea(id, u);
    const audio = await this.prisma.audioComentario.findFirst({
      where: { id: audioId, actividadId: id },
      select: { id: true, autorId: true, claveObjeto: true },
    });
    if (!audio) throw new NotFoundException('El comentario de voz no existe.');
    if (!puedeEliminarAudio(u, audio.autorId)) {
      throw new ForbiddenException('Solo quien grabo el audio o un administrador pueden quitarlo.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.audioComentario.delete({ where: { id: audio.id } });
      await tx.registroAuditoria.create({
        data: {
          actorId: u.id,
          organizacionId: tarea.proyecto.organizacionId,
          accion: 'ACTIVIDAD_AUDIO_QUITADO',
          tipoEntidad: 'Actividad',
          entidadId: id,
          valorAnterior: { audioId: audio.id, autorId: audio.autorId },
        },
      });
    });
    await this.borrarArchivo(audio.claveObjeto);
    return { ok: true };
  }

  /** El audio, para quien puede ver la tarea (misma empresa). */
  async obtener(id: string, audioId: string, u: UsuarioActual) {
    await this.tarea(id, u);
    const audio = await this.prisma.audioComentario.findFirst({
      where: { id: audioId, actividadId: id },
      select: { claveObjeto: true },
    });
    if (!audio) throw new NotFoundException('El comentario de voz no existe.');

    const { flujo, tipoMime, tamanoBytes } = await this.almacenamiento.descargar(audio.claveObjeto);
    const tipo = FIRMAS.some((f) => f.tipo === tipoMime) ? tipoMime! : 'application/octet-stream';
    return { flujo, tipo, tamanoBytes };
  }

  /** La tarea, solo si es de la empresa de quien pregunta. */
  private async tarea(id: string, u: UsuarioActual): Promise<Tarea> {
    const tarea = await this.prisma.actividad.findFirst({
      where: { id, eliminadoEn: null, ...filtroActividadOrganizacion(u) },
      select: { creadoPorId: true, responsableId: true, proyecto: { select: { organizacionId: true } } },
    });
    if (!tarea) throw new NotFoundException('La actividad no existe.');
    return tarea;
  }

  /** Borrar el archivo es limpieza: si falla, el registro ya se quito. */
  private async borrarArchivo(claveObjeto: string) {
    try {
      await this.almacenamiento.eliminar(claveObjeto);
    } catch (error) {
      this.registro.warn(`No se pudo borrar un comentario de voz: ${(error as Error).message}`);
    }
  }
}
