import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Usuario, UsuarioActual } from '../../common/usuario-actual.decorator';
import { NotificacionesService } from './notificaciones.service';

@ApiTags('notificaciones')
@UseGuards(JwtAuthGuard)
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificaciones: NotificacionesService) {}

  @Get()
  listar(@Usuario() u: UsuarioActual, @Query('limite') limite?: string) {
    const parsed = limite ? Number(limite) : 25;
    return this.notificaciones.listar(u, Number.isFinite(parsed) ? parsed : 25);
  }

  @Patch(':id/leer')
  marcarLeida(@Usuario() u: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificaciones.marcarLeida(u, id);
  }

  @Post('leer-todas')
  marcarTodasLeidas(@Usuario() u: UsuarioActual) {
    return this.notificaciones.marcarTodasLeidas(u);
  }
}
