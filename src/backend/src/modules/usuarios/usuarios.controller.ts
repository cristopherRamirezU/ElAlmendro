import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISOS, Rol } from '../../common/rbac';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermisosGuard } from '../../common/guards/permisos.guard';
import { ExigirPermisos } from '../../common/decorators/permisos.decorator';
import { Usuario, UsuarioActual } from '../../common/usuario-actual.decorator';
import { UsuariosService } from './usuarios.service';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { ActualizarPermisosUsuarioDto } from './dto/actualizar-permisos-usuario.dto';

@ApiTags('usuarios')
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  /**
   * Catálogo de roles con sus permisos asignados.
   */
  @Get('roles')
  @ExigirPermisos(PERMISOS.USUARIOS_VER)
  listarRoles() {
    return this.usuarios.listarRoles();
  }

  /**
   * La nómina completa es información del equipo. Un trabajador común que consulte
   * esto se recibe a sí mismo para poblar selectores.
   */
  @Get('trabajadores')
  trabajadores(@Usuario() u: UsuarioActual) {
    const puedeVerEquipo =
      u.rol === 'ADMINISTRADOR' || u.rol === 'SUPERVISOR' || u.rol === 'SUPER_ADMIN';
    return this.usuarios.trabajadores(u, puedeVerEquipo ? undefined : u.id);
  }

  /**
   * Listado general de usuarios para administración, con filtros de búsqueda.
   */
  @Get()
  @ExigirPermisos(PERMISOS.USUARIOS_VER)
  listarTodos(
    @Usuario() u: UsuarioActual,
    @Query('rol') rol?: Rol,
    @Query('activo') activo?: string,
    @Query('q') busqueda?: string,
  ) {
    const esActivo =
      activo === 'true' ? true : activo === 'false' ? false : undefined;

    return this.usuarios.listarTodos(u, {
      rol,
      activo: esActivo,
      busqueda,
    });
  }

  /**
   * Obtiene la ficha de un usuario en específico.
   */
  @Get(':id')
  @ExigirPermisos(PERMISOS.USUARIOS_VER)
  detalle(@Usuario() u: UsuarioActual, @Param('id') id: string) {
    return this.usuarios.detalle(u, id);
  }

  /**
   * Creación de un nuevo trabajador o usuario con asignación de rol.
   */
  @Post()
  @ExigirPermisos(PERMISOS.USUARIOS_GESTIONAR)
  crear(@Usuario() u: UsuarioActual, @Body() dto: CrearUsuarioDto) {
    return this.usuarios.crear(u, dto);
  }

  /**
   * Modificación de datos de un usuario (nombre, rol, estado activo o reseteo de clave).
   */
  @Patch(':id')
  @ExigirPermisos(PERMISOS.USUARIOS_GESTIONAR)
  actualizar(
    @Usuario() u: UsuarioActual,
    @Param('id') id: string,
    @Body() dto: ActualizarUsuarioDto,
  ) {
    return this.usuarios.actualizar(u, id, dto);
  }

  /**
   * Permisos extra de un trabajador, además de los de su rol (editar el mapa,
   * eliminar tareas). Solo el administrador de la misma organización.
   */
  @Patch(':id/permisos')
  @ExigirPermisos(PERMISOS.USUARIOS_GESTIONAR)
  actualizarPermisos(
    @Usuario() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarPermisosUsuarioDto,
  ) {
    return this.usuarios.actualizarPermisos(u, id, dto);
  }

  /**
   * Desactivación lógica (Soft Delete) de un usuario.
   */
  @Delete(':id')
  @ExigirPermisos(PERMISOS.USUARIOS_GESTIONAR)
  desactivar(@Usuario() u: UsuarioActual, @Param('id') id: string) {
    return this.usuarios.desactivar(u, id);
  }
}
