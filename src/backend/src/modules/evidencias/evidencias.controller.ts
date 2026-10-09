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
  @UseInterceptors(FileInterceptor('archivo'))
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
      'Content-Type': evidencia.tipoMime,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(evidencia.nombreArchivo)}"`,
    });
    return new StreamableFile(flujo);
  }
}
