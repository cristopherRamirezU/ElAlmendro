import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { IsNumberString, IsOptional } from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Usuario, UsuarioActual } from '../../common/usuario-actual.decorator';
import {
  AudioComentarioService,
  ErroresAudioFilter,
  OPCIONES_SUBIDA_AUDIO,
} from './audio-comentario.service';

class SubirAudioDto {
  /** Duracion medida por el navegador al grabar, en segundos. */
  @IsOptional()
  @IsNumberString()
  segundos?: string;
}

@ApiTags('actividades')
@UseGuards(JwtAuthGuard)
@Controller('actividades')
export class AudioComentarioController {
  constructor(private readonly audios: AudioComentarioService) {}

  /** Graba (o reemplaza) el comentario de voz de la tarea. */
  @Post(':id/audio')
  @HttpCode(200)
  @UseFilters(ErroresAudioFilter)
  @UseInterceptors(FileInterceptor('audio', OPCIONES_SUBIDA_AUDIO))
  subir(
    @Usuario() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubirAudioDto,
    @UploadedFile() archivo: Express.Multer.File,
  ) {
    return this.audios.subir(id, u, archivo, dto.segundos);
  }

  @Delete(':id/audio')
  quitar(@Usuario() u: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.audios.quitar(id, u);
  }

  /** El audio en si. La URL lleva la version (?v=...): puede quedar en cache. */
  @Get(':id/audio')
  async obtener(
    @Usuario() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { flujo, tipo, tamanoBytes } = await this.audios.obtener(id, u);
    res.set({
      'Content-Type': tipo,
      ...(tamanoBytes ? { 'Content-Length': String(tamanoBytes) } : {}),
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=604800',
    });
    return new StreamableFile(flujo);
  }
}
