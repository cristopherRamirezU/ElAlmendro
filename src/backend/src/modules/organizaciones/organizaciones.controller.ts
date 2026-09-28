import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrganizacionesService } from './organizaciones.service';
import { CrearOrganizacionDto } from './dto/crear-organizacion.dto';
import { ActualizarOrganizacionDto } from './dto/actualizar-organizacion.dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermisosGuard } from '../../common/guards/permisos.guard';
import { ExigirPermisos } from '../../common/decorators/permisos.decorator';
import { PERMISOS } from '../../common/rbac';
import { Usuario, UsuarioActual } from '../../common/usuario-actual.decorator';

@ApiTags('organizaciones')
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('organizaciones')
export class OrganizacionesController {
  constructor(private readonly organizacionesService: OrganizacionesService) {}

  @Get('metricas')
  @ExigirPermisos(PERMISOS.ORGANIZACIONES_VER)
  async metricas() {
    return this.organizacionesService.obtenerMetricasGlobales();
  }

  @Get()
  @ExigirPermisos(PERMISOS.ORGANIZACIONES_VER)
  async listar(
    @Query('buscar') buscar?: string,
    @Query('activo') activo?: string,
  ) {
    const activoBool = activo !== undefined ? activo === 'true' : undefined;
    return this.organizacionesService.listar(buscar, activoBool);
  }

  @Get(':id')
  @ExigirPermisos(PERMISOS.ORGANIZACIONES_VER)
  async obtenerPorId(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizacionesService.obtenerPorId(id);
  }

  @Post()
  @ExigirPermisos(PERMISOS.ORGANIZACIONES_GESTIONAR)
  async crear(
    @Body() dto: CrearOrganizacionDto,
    @Usuario() usuario: UsuarioActual,
  ) {
    return this.organizacionesService.crear(dto, usuario.id);
  }

  @Patch(':id')
  @ExigirPermisos(PERMISOS.ORGANIZACIONES_GESTIONAR)
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarOrganizacionDto,
    @Usuario() usuario: UsuarioActual,
  ) {
    return this.organizacionesService.actualizar(id, dto, usuario.id);
  }
}
