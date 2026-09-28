import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProyectosService } from './proyectos.service';
import { CrearProyectoDto } from './dto/crear-proyecto.dto';
import { ActualizarProyectoDto } from './dto/actualizar-proyecto.dto';
import { AgregarMiembroDto } from './dto/agregar-miembro.dto';
import { PERMISOS } from '../../common/rbac';
import { PermisosGuard } from '../../common/guards/permisos.guard';
import { ExigirPermisos } from '../../common/decorators/permisos.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Usuario, UsuarioActual } from '../../common/usuario-actual.decorator';

@ApiTags('proyectos')
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('proyectos')
export class ProyectosController {
  constructor(private readonly proyectos: ProyectosService) {}

  /** Proyectos del trabajador de la sesion (propios o donde es miembro). */
  @Get('mios')
  mios(@Usuario() u: UsuarioActual) {
    return this.proyectos.mios(u);
  }

  @Post()
  crear(@Usuario() u: UsuarioActual, @Body() dto: CrearProyectoDto) {
    return this.proyectos.crear(u, dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id') id: string,
    @Usuario() u: UsuarioActual,
    @Body() dto: ActualizarProyectoDto,
  ) {
    return this.proyectos.actualizar(id, u, dto);
  }

  /** Equipo del proyecto. */
  @Get(':id/miembros')
  miembros(@Param('id') id: string, @Usuario() u: UsuarioActual) {
    return this.proyectos.miembros(id, u);
  }

  /** Asigna una persona al proyecto (administrador o supervisor). */
  @Post(':id/miembros')
  @ExigirPermisos(PERMISOS.ACTIVIDADES_GESTIONAR)
  agregarMiembro(
    @Param('id') id: string,
    @Usuario() u: UsuarioActual,
    @Body() dto: AgregarMiembroDto,
  ) {
    return this.proyectos.agregarMiembro(id, u.id, dto.usuarioId);
  }

  @Delete(':id/miembros/:usuarioId')
  @ExigirPermisos(PERMISOS.ACTIVIDADES_GESTIONAR)
  quitarMiembro(
    @Param('id') id: string,
    @Param('usuarioId') usuarioId: string,
    @Usuario() u: UsuarioActual,
  ) {
    return this.proyectos.quitarMiembro(id, u.id, usuarioId);
  }

  /** Elimina un proyecto y todos sus nodos asociados (Solo Administrador / Super Admin). */
  @Delete(':id')
  eliminar(@Param('id') id: string, @Usuario() u: UsuarioActual) {
    return this.proyectos.eliminar(id, u);
  }
}

