import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISOS } from '../../common/rbac';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermisosGuard } from '../../common/guards/permisos.guard';
import { ExigirPermisos } from '../../common/decorators/permisos.decorator';

import { Usuario, UsuarioActual } from '../../common/usuario-actual.decorator';

@ApiTags('dashboard')
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('resumen')
  @ExigirPermisos(PERMISOS.DASHBOARD_VER_RESUMEN)
  resumen(@Usuario() u: UsuarioActual) {
    return this.dashboard.resumen(u);
  }

  /** Indicadores individuales de rendimiento para el dashboard del trabajador. */
  @Get('mi-progreso')
  miProgreso(@Usuario() u: UsuarioActual) {
    return this.dashboard.progresoPersonal(u.id);
  }
}
