import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ExigirPermisos } from '../../common/decorators/permisos.decorator';
import { PermisosGuard } from '../../common/guards/permisos.guard';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PERMISOS } from '../../common/rbac';
import { Usuario, UsuarioActual } from '../../common/usuario-actual.decorator';
import { ConsultarHistorialDto } from './dto/consultar-historial.dto';
import { HistorialService } from './historial.service';

@ApiTags('historial')
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('historial')
export class HistorialController {
  constructor(private readonly historial: HistorialService) {}

  @Get()
  @ExigirPermisos(PERMISOS.HISTORIAL_VER)
  listar(@Usuario() u: UsuarioActual, @Query() q: ConsultarHistorialDto) {
    return this.historial.listar(u, q);
  }
}
