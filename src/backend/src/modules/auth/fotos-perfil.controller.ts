import { Controller, Get, Param, ParseUUIDPipe, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Usuario, UsuarioActual } from '../../common/usuario-actual.decorator';
import { FotoPerfilService } from './foto-perfil.service';

@ApiTags('auth')
@UseGuards(JwtAuthGuard)
@Controller('fotos-perfil')
export class FotosPerfilController {
  constructor(private readonly fotos: FotoPerfilService) {}

  /**
   * Foto de perfil de un companero de empresa. La URL lleva la version
   * (?v=...), asi que puede quedar en cache del navegador: al cambiar la foto
   * cambia la URL.
   */
  @Get(':usuarioId')
  async obtener(
    @Usuario() u: UsuarioActual,
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { flujo, tipo } = await this.fotos.obtener(u, usuarioId);
    res.set({
      'Content-Type': tipo,
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=604800',
      // Helmet deja same-origin: en desarrollo la web (puerto 3000) y la API
      // (4000) son el mismo sitio pero no el mismo origen, y la imagen no cargaria.
      'Cross-Origin-Resource-Policy': 'same-site',
    });
    return new StreamableFile(flujo);
  }
}
