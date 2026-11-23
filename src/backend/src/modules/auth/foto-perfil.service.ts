import {
  BadRequestException,
  Catch,
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
import { LimiteIntentosService, REGLAS } from '../../common/seguridad/limite-intentos.service';
import { ErroresSubidaFilter } from '../evidencias/errores-subida.filter';

export const FOTO_MAXIMA_MB = 2;

/**
 * La foto llega ya recortada y reducida por el navegador (256 px): 2 MB sobra
 * y corta antes cualquier envio desmedido.
 */
export const OPCIONES_SUBIDA_FOTO: MulterOptions = {
  limits: { fileSize: FOTO_MAXIMA_MB * 1024 * 1024, files: 1, fields: 0, parts: 1 },
};

/** Mismo filtro de errores de subida, informando el limite de las fotos. */
@Catch(HttpException)
export class ErroresFotoFilter extends ErroresSubidaFilter {
  protected readonly limiteMb = FOTO_MAXIMA_MB;
}

/** Formatos aceptados, reconocidos por su firma y no por lo que declara el navegador. */
const FIRMAS: { tipo: string; coincide: (b: Buffer) => boolean }[] = [
  { tipo: 'image/jpeg', coincide: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    tipo: 'image/png',
    coincide: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    tipo: 'image/webp',
    coincide: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  },
];

const clave = (usuarioId: string, version: string) => `fotos-perfil/${usuarioId}/${version}`;

/**
 * Foto de perfil de cada usuario. Se guarda en el mismo almacenamiento que
 * las evidencias; en la base solo queda la version vigente, que forma parte
 * de la URL: al cambiar la foto cambia la URL y ninguna cache muestra la vieja.
 */
@Injectable()
export class FotoPerfilService {
  private readonly registro = new Logger(FotoPerfilService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly almacenamiento: AlmacenamientoService,
    private readonly limites: LimiteIntentosService,
  ) {}

  async subir(u: UsuarioActual, archivo: Express.Multer.File | undefined) {
    if (!archivo?.buffer?.length) throw new BadRequestException('Adjunta una imagen.');
    const tipo = FIRMAS.find((f) => f.coincide(archivo.buffer))?.tipo;
    if (!tipo) throw new BadRequestException('La foto debe ser una imagen JPG, PNG o WebP.');
    this.limites.consumir(`subida:${u.id}`, REGLAS.subidaArchivos);

    const version = randomUUID();
    await this.almacenamiento.subir(clave(u.id, version), archivo.buffer, tipo);

    try {
      const anterior = await this.prisma.usuario.findUnique({ where: { id: u.id }, select: { fotoPerfil: true } });
      await this.prisma.usuario.update({ where: { id: u.id }, data: { fotoPerfil: version } });
      if (anterior?.fotoPerfil) await this.borrarArchivo(u.id, anterior.fotoPerfil);
    } catch (error) {
      await this.borrarArchivo(u.id, version);
      throw error;
    }

    return { fotoPerfil: version };
  }

  async quitar(u: UsuarioActual) {
    const anterior = await this.prisma.usuario.findUnique({ where: { id: u.id }, select: { fotoPerfil: true } });
    await this.prisma.usuario.update({ where: { id: u.id }, data: { fotoPerfil: null } });
    if (anterior?.fotoPerfil) await this.borrarArchivo(u.id, anterior.fotoPerfil);
    return { fotoPerfil: null };
  }

  /** La foto de un companero: solo dentro de la misma empresa. */
  async obtener(solicitante: UsuarioActual, usuarioId: string) {
    const dueno = await this.prisma.usuario.findFirst({
      where: {
        id: usuarioId,
        ...(solicitante.rol === 'SUPER_ADMIN' ? {} : { organizacionId: solicitante.organizacionId }),
      },
      select: { fotoPerfil: true },
    });
    if (!dueno?.fotoPerfil) throw new NotFoundException('Sin foto de perfil.');

    const { flujo, tipoMime } = await this.almacenamiento.descargar(clave(usuarioId, dueno.fotoPerfil));
    const tipo = FIRMAS.some((f) => f.tipo === tipoMime) ? tipoMime! : 'application/octet-stream';
    return { flujo, tipo };
  }

  /** Borrar la foto vieja es limpieza: si falla, la nueva ya quedo guardada. */
  private async borrarArchivo(usuarioId: string, version: string) {
    try {
      await this.almacenamiento.eliminar(clave(usuarioId, version));
    } catch (error) {
      this.registro.warn(`No se pudo borrar una foto de perfil anterior: ${(error as Error).message}`);
    }
  }
}
