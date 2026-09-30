import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CalendarioService } from './calendario.service';
import { RangoDto } from './dto/consulta.dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Usuario, UsuarioActual } from '../../common/usuario-actual.decorator';
import { exigirOrganizacion } from '../../common/organizacion';

@ApiTags('calendario')
@UseGuards(JwtAuthGuard)
@Controller('calendario')
export class CalendarioController {
  constructor(private readonly calendario: CalendarioService) {}

  /**
   * El calendario es siempre de una sola empresa: la organizacion sale de la
   * sesion y acota todas las consultas, aunque llegue un trabajadorId ajeno.
   *
   * El administrador elige a quien mirar; el trabajador solo se ve a si mismo.
   *
   * El `trabajadorId` que llega en la consulta se descarta cuando quien pregunta
   * no es administrador: la interfaz oculta el selector, pero confiar en eso
   * dejaria los datos del equipo a un cambio de URL de distancia.
   */
  private alcance(u: UsuarioActual, pedido?: string): string | undefined {
    const puedeVerEquipo =
      u.permisos?.includes('calendario:ver_equipo') ||
      u.rol === 'ADMINISTRADOR' ||
      u.rol === 'SUPERVISOR';
    if (!puedeVerEquipo) return u.id;
    return pedido || undefined;
  }

  /** Matriz dia x trabajador: alimenta la rejilla mensual y la vista matriz. */
  @Get('resumen')
  resumen(@Usuario() u: UsuarioActual, @Query() q: RangoDto) {
    return this.calendario.resumen(exigirOrganizacion(u), q.desde, q.hasta, this.alcance(u, q.trabajadorId));
  }

  /** Sesiones y jornadas del rango: alimenta el panel del dia y la semana. */
  @Get('detalle')
  detalle(@Usuario() u: UsuarioActual, @Query() q: RangoDto) {
    return this.calendario.detalle(exigirOrganizacion(u), q.desde, q.hasta, this.alcance(u, q.trabajadorId));
  }
}
