import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SesionesService } from './sesiones.service';
import { CerrarSesionDto, IniciarSesionDto } from './dto/sesion.dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Usuario, UsuarioActual } from '../../common/usuario-actual.decorator';

@ApiTags('sesiones')
@UseGuards(JwtAuthGuard)
@Controller('sesiones')
export class SesionesController {
  constructor(private readonly sesiones: SesionesService) {}

  @Get('activa')
  activa(@Usuario() u: UsuarioActual) {
    return this.sesiones.activa(u.id);
  }

  @Post('iniciar')
  iniciar(@Usuario() u: UsuarioActual, @Body() dto: IniciarSesionDto) {
    return this.sesiones.iniciar(u.id, dto);
  }

  @Post(':id/pausar')
  pausar(@Usuario() u: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.sesiones.pausar(u.id, id);
  }

  @Post(':id/reanudar')
  reanudar(@Usuario() u: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.sesiones.reanudar(u.id, id);
  }

  @Post(':id/cerrar')
  cerrar(
    @Usuario() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CerrarSesionDto,
  ) {
    return this.sesiones.cerrar(u.id, id, dto);
  }
}
