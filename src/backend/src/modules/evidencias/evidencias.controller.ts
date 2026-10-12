import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { EvidenciasService } from './evidencias.service';
import { ListarEvidenciasDto } from './dto/listar-evidencias.dto';
import { SubirEvidenciaDto } from './dto/subir-evidencia.dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Usuario, UsuarioActual } from '../../common/usuario-actual.decorator';
import { ErroresSubidaFilter } from './errores-subida.filter';
import { limpiarTipoMime, OPCIONES_SUBIDA } from './limites-subida';

@ApiTags('evidencias')
@UseGuards(JwtAuthGuard)
@Controller('evidencias')
export class EvidenciasController {
  constructor(private readonly evidencias: EvidenciasService) {}

  @Get()
  listar(@Usuario() u: UsuarioActual, @Query() dto: ListarEvidenciasDto) {
    return this.evidencias.listar(u, dto.actividadId);
  }

  @Post()
  @UseFilters(ErroresSubidaFilter)
  @UseInterceptors(FileInterceptor('archivo', OPCIONES_SUBIDA))
  subir(
    @Usuario() u: UsuarioActual,
    @Body() dto: SubirEvidenciaDto,
    @UploadedFile() archivo: Express.Multer.File,
  ) {
    return this.evidencias.subir(u, dto.actividadId, archivo);
  }

  /** Quien subio el archivo o un administrador; nunca en una tarea completada. */
  @Delete(':id')
  eliminar(@Usuario() u: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.evidencias.eliminar(u, id);
  }

  @Get(':id/descargar')
  async descargar(
    @Usuario() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { flujo, evidencia } = await this.evidencias.obtenerParaDescarga(u, id);
    res.set({
      'Content-Type': limpiarTipoMime(evidencia.tipoMime),
      // Siempre como descarga, nunca abierto dentro de la app: un HTML o SVG
      // subido no puede ejecutar scripts con la sesion de quien lo abre.
      'Content-Disposition': dispositionDescarga(evidencia.nombreArchivo),
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(flujo);
  }
}

/**
 * Content-Disposition con el nombre original: version ASCII para
 * navegadores antiguos y `filename*` (RFC 5987) con el nombre real en UTF-8.
 */
function dispositionDescarga(nombre: string): string {
  const ascii = nombre.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '') || 'archivo';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
