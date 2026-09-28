import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JornadaService } from './jornada.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Usuario, UsuarioActual } from '../../common/usuario-actual.decorator';

@ApiTags('jornadas')
@UseGuards(JwtAuthGuard)
@Controller('jornadas')
export class JornadaController {
  constructor(private readonly jornadas: JornadaService) {}

  @Get('actual')
  actual(@Usuario() u: UsuarioActual) {
    return this.jornadas.actual(u.id);
  }

  @Post('entrada')
  entrada(@Usuario() u: UsuarioActual) {
    return this.jornadas.entrada(u.id, u.organizacionId);
  }

  @Post('salida')
  salida(@Usuario() u: UsuarioActual) {
    return this.jornadas.salida(u.id);
  }
}
