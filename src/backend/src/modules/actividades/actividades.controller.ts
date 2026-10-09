import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ActividadesService } from './actividades.service';
import { CrearActividadDto } from './dto/crear-actividad.dto';
import { ActualizarActividadDto } from './dto/actualizar-actividad.dto';
import { ReasignarActividadDto } from './dto/reasignar-actividad.dto';
import { ActualizarInstruccionesDto } from './dto/actualizar-instrucciones.dto';
import { GuardarPosicionesDto } from './dto/guardar-posiciones.dto';
import { GuardarLadosDto } from './dto/guardar-lados.dto';
import {
  ActualizarSubtareaDto,
  CambiarEstadoActividadDto,
  CrearSubtareaDto,
} from './dto/subtarea.dto';
import { PERMISOS } from '../../common/rbac';
import { PermisosGuard } from '../../common/guards/permisos.guard';
import { ExigirPermisos } from '../../common/decorators/permisos.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Usuario, UsuarioActual } from '../../common/usuario-actual.decorator';

@ApiTags('actividades')
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('actividades')
export class ActividadesController {
  constructor(private readonly actividades: ActividadesService) {}

  /** Actividades asignadas al trabajador de la sesion. */
  @Get('mias')
  mias(@Usuario() u: UsuarioActual) {
    return this.actividades.mias(u);
  }

  /** Crea una tarea nueva, opcionalmente colgada de otra (mapa de nodos). */
  @Post()
  crear(@Usuario() u: UsuarioActual, @Body() dto: CrearActividadDto) {
    return this.actividades.crear(u, dto);
  }

  /**
   * Guarda donde quedaron los nodos movidos en el mapa (modo edicion): lo
   * hace quien tiene permiso para editar el mapa, por su rol o porque el
   * administrador se lo dio. Va antes de las rutas con ':id' para que
   * "posiciones" no se tome como identificador.
   */
  @Patch('posiciones')
  @ExigirPermisos(PERMISOS.NODOS_EDITAR)
  guardarPosiciones(@Usuario() u: UsuarioActual, @Body() dto: GuardarPosicionesDto) {
    return this.actividades.guardarPosiciones(u, dto);
  }

  /**
   * Fija por que borde sale o llega la linea de una tarea (o la devuelve al
   * modo automatico). Mismo permiso que mover nodos; va antes de ':id'.
   */
  @Patch('lados')
  @ExigirPermisos(PERMISOS.NODOS_EDITAR)
  guardarLados(@Usuario() u: UsuarioActual, @Body() dto: GuardarLadosDto) {
    return this.actividades.guardarLados(u, dto);
  }

  /**
   * Monedas de la bolsa (microtareas). Se declaran antes que las rutas con
   * ':id' porque Nest resuelve por orden: "subtareas" seria tomado como el
   * identificador de una actividad.
   */
  @Patch('subtareas/:subtareaId')
  actualizarSubtarea(
    @Param('subtareaId', ParseUUIDPipe) subtareaId: string,
    @Usuario() u: UsuarioActual,
    @Body() dto: ActualizarSubtareaDto,
  ) {
    return this.actividades.actualizarSubtarea(subtareaId, u, dto);
  }

  @Delete('subtareas/:subtareaId')
  eliminarSubtarea(
    @Param('subtareaId', ParseUUIDPipe) subtareaId: string,
    @Usuario() u: UsuarioActual,
  ) {
    return this.actividades.eliminarSubtarea(subtareaId, u);
  }

  @Post(':id/subtareas')
  crearSubtarea(
    @Param('id', ParseUUIDPipe) id: string,
    @Usuario() u: UsuarioActual,
    @Body() dto: CrearSubtareaDto,
  ) {
    return this.actividades.crearSubtarea(id, u, dto);
  }

  /** Guarda la bolsa en el cofre, o la saca para seguir trabajandola. */
  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Usuario() u: UsuarioActual,
    @Body() dto: CambiarEstadoActividadDto,
  ) {
    return this.actividades.cambiarEstado(id, u, dto);
  }

  /** Instrucciones de la tarea: las edita quien la creo o un administrador. */
  @Patch(':id/instrucciones')
  actualizarInstrucciones(
    @Param('id', ParseUUIDPipe) id: string,
    @Usuario() u: UsuarioActual,
    @Body() dto: ActualizarInstruccionesDto,
  ) {
    return this.actividades.actualizarInstrucciones(id, u, dto);
  }

  @Get(':id')
  detalle(@Param('id', ParseUUIDPipe) id: string, @Usuario() u: UsuarioActual) {
    return this.actividades.detalle(id, u);
  }

  /** Reasigna el padre de la tarea en el arbol de nodos. */
  @Patch(':id')
  @ExigirPermisos(PERMISOS.ACTIVIDADES_GESTIONAR)
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Usuario() u: UsuarioActual,
    @Body() dto: ActualizarActividadDto,
  ) {
    return this.actividades.actualizarPadre(id, u, dto);
  }

  /** US-06 — deriva la tarea a otra persona (administrador o supervisor). */
  @Patch(':id/responsable')
  @ExigirPermisos(PERMISOS.ACTIVIDADES_GESTIONAR)
  reasignar(
    @Param('id', ParseUUIDPipe) id: string,
    @Usuario() u: UsuarioActual,
    @Body() dto: ReasignarActividadDto,
  ) {
    return this.actividades.reasignar(id, u, dto);
  }

  /** Elimina un nodo (actividad) y sus ramas dependientes (permiso actividades:eliminar). */
  @Delete(':id')
  eliminar(
    @Param('id', ParseUUIDPipe) id: string,
    @Usuario() u: UsuarioActual,
  ) {
    return this.actividades.eliminar(id, u);
  }
}

