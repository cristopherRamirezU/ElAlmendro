import {
  Controller,
  Get,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PERMISOS } from '../../common/rbac';
import { ReportesService } from './reportes.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermisosGuard } from '../../common/guards/permisos.guard';
import { ExigirPermisos } from '../../common/decorators/permisos.decorator';
import { Usuario, UsuarioActual } from '../../common/usuario-actual.decorator';
import { exigirOrganizacion } from '../../common/organizacion';
import { ExportacionService } from '../../common/exportacion/exportacion.service';
import { Columna, Seccion } from '../../common/exportacion/columna';
import {
  FormatoExportacion,
  nombreExportacion,
  prepararDescarga,
} from '../../common/exportacion/descarga';
import { ExportarDiaDto, ExportarPeriodoDto } from './dto/exportar.dto';

type Fila = Record<string, unknown>;

const COLUMNAS_TRABAJADOR: Columna<Fila>[] = [
  { clave: 'trabajador', titulo: 'Trabajador', ancho: 30 },
  { clave: 'segundos', titulo: 'Horas', formato: 'duracion', ancho: 14 },
  { clave: 'dias', titulo: 'Dias', formato: 'entero', ancho: 10 },
  { clave: 'sesiones', titulo: 'Sesiones', formato: 'entero', ancho: 12 },
  { clave: 'actividades', titulo: 'Actividades', formato: 'entero', ancho: 14 },
];

const COLUMNAS_ACTIVIDAD: Columna<Fila>[] = [
  { clave: 'actividad', titulo: 'Actividad', ancho: 40 },
  { clave: 'estado', titulo: 'Estado', ancho: 16 },
  { clave: 'segundos', titulo: 'Horas', formato: 'duracion', ancho: 14 },
];

const COLUMNAS_CALENDARIO: Columna<Fila>[] = [
  { clave: 'dia', titulo: 'Dia', ancho: 16 },
  { clave: 'segundos', titulo: 'Horas', formato: 'duracion', ancho: 14 },
  { clave: 'sesiones', titulo: 'Sesiones', formato: 'entero', ancho: 12 },
];

const COLUMNAS_DIA: Columna<Fila>[] = [
  { clave: 'trabajador', titulo: 'Trabajador', ancho: 26 },
  { clave: 'actividad', titulo: 'Actividad', ancho: 34 },
  { clave: 'inicioEn', titulo: 'Inicio', formato: 'fecha', ancho: 22 },
  { clave: 'terminoEn', titulo: 'Termino', formato: 'fecha', ancho: 22 },
  { clave: 'segundos', titulo: 'Duracion', formato: 'duracion', ancho: 14 },
  { clave: 'estado', titulo: 'Estado', ancho: 14 },
  { clave: 'desenlace', titulo: 'Desenlace', ancho: 16 },
  { clave: 'notaCierre', titulo: 'Nota de cierre', ancho: 40 },
];

@ApiTags('reportes')
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('reportes')
export class ReportesController {
  constructor(
    private readonly reportes: ReportesService,
    private readonly exportacion: ExportacionService,
  ) {}

  /**
   * Administradores y supervisores ven a todo el equipo; el trabajador, solo lo suyo.
   *
   * Lo usan tanto los endpoints JSON como sus exportaciones: una descarga que
   * se saltara este filtro seria una fuga de datos del resto del equipo.
   */
  private alcance(u: UsuarioActual): string | undefined {
    const puedeVerEquipo =
      u.permisos?.includes(PERMISOS.REPORTES_VER_EQUIPO) ||
      u.rol === 'ADMINISTRADOR' ||
      u.rol === 'SUPERVISOR';
    return puedeVerEquipo ? undefined : u.id;
  }

  private resolverOrgId(u: UsuarioActual, queryOrgId?: string): string | null {
    if (u.rol === 'SUPER_ADMIN') {
      return queryOrgId?.trim() ? queryOrgId.trim() : null;
    }
    return exigirOrganizacion(u);
  }

  @Get('calendario')
  calendario(
    @Usuario() u: UsuarioActual,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('organizacionId') orgId?: string,
  ) {
    return this.reportes.calendario(
      new Date(desde),
      new Date(hasta),
      this.alcance(u),
      this.resolverOrgId(u, orgId),
    );
  }

  @Get('dia')
  dia(
    @Usuario() u: UsuarioActual,
    @Query('fecha') fecha: string,
    @Query('organizacionId') orgId?: string,
  ) {
    return this.reportes.dia(fecha, this.alcance(u), this.resolverOrgId(u, orgId));
  }

  @Get('horas')
  @ExigirPermisos(PERMISOS.REPORTES_VER_EQUIPO)
  horas(
    @Usuario() u: UsuarioActual,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('organizacionId') orgId?: string,
  ) {
    return this.reportes.porTrabajador(
      new Date(desde),
      new Date(hasta),
      this.resolverOrgId(u, orgId),
    );
  }

  @Get('actividades')
  @ExigirPermisos(PERMISOS.REPORTES_VER_EQUIPO)
  actividades(
    @Usuario() u: UsuarioActual,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('organizacionId') orgId?: string,
  ) {
    return this.reportes.porActividad(
      new Date(desde),
      new Date(hasta),
      this.resolverOrgId(u, orgId),
    );
  }

  // -------------------------------------------------------- exportaciones

  /**
   * Reporte del periodo en un solo archivo: horas por trabajador y reparto
   * por actividad.
   *
   * Exige REPORTES_VER_EQUIPO igual que sus equivalentes JSON, porque las
   * consultas que lo alimentan agregan a todo el equipo y no aceptan filtro
   * por usuario.
   */
  @Get('periodo/exportar')
  @ExigirPermisos(PERMISOS.REPORTES_VER_EQUIPO)
  async exportarPeriodo(
    @Usuario() u: UsuarioActual,
    @Query() q: ExportarPeriodoDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const desde = new Date(q.desde);
    const hasta = new Date(q.hasta);

    const orgId = this.resolverOrgId(u, q.organizacionId);

    const [porTrabajador, porActividad] = await Promise.all([
      this.reportes.porTrabajador(desde, hasta, orgId),
      this.reportes.porActividad(desde, hasta, orgId),
    ]);

    return this.entregar(
      res,
      q.formato,
      nombreExportacion('horas', desde, hasta, q.formato),
      [
        {
          nombre: 'Horas por trabajador',
          columnas: COLUMNAS_TRABAJADOR,
          filas: porTrabajador as Fila[],
        },
        {
          nombre: 'Horas por actividad',
          columnas: COLUMNAS_ACTIVIDAD,
          filas: porActividad as Fila[],
        },
      ],
      {
        titulo: 'TimeFlow - Reporte de horas',
        subtitulo: `Periodo ${q.desde.slice(0, 10)} a ${q.hasta.slice(0, 10)}`,
        separador: q.sep,
      },
    );
  }

  /**
   * Horas por dia del periodo. Sin @ExigirPermisos a proposito: respeta
   * alcance(), de modo que un trabajador exporta su propio calendario.
   */
  @Get('calendario/exportar')
  async exportarCalendario(
    @Usuario() u: UsuarioActual,
    @Query() q: ExportarPeriodoDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const desde = new Date(q.desde);
    const hasta = new Date(q.hasta);

    const filas = await this.reportes.calendario(
      desde,
      hasta,
      this.alcance(u),
      this.resolverOrgId(u, q.organizacionId),
    );

    return this.entregar(
      res,
      q.formato,
      nombreExportacion('calendario', desde, hasta, q.formato),
      [
        {
          nombre: 'Horas por dia',
          columnas: COLUMNAS_CALENDARIO,
          filas: filas as Fila[],
        },
      ],
      {
        titulo: 'TimeFlow - Calendario de horas',
        subtitulo: `Periodo ${q.desde.slice(0, 10)} a ${q.hasta.slice(0, 10)}`,
        separador: q.sep,
      },
    );
  }

  /** Detalle de las sesiones de un dia. Tambien respeta alcance(). */
  @Get('dia/exportar')
  async exportarDia(
    @Usuario() u: UsuarioActual,
    @Query() q: ExportarDiaDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const filas = await this.reportes.dia(
      q.fecha,
      this.alcance(u),
      this.resolverOrgId(u, q.organizacionId),
    );

    return this.entregar(
      res,
      q.formato,
      nombreExportacion('dia', q.fecha, q.fecha, q.formato),
      [
        {
          nombre: 'Sesiones del dia',
          columnas: COLUMNAS_DIA,
          filas: filas as Fila[],
        },
      ],
      {
        titulo: 'TimeFlow - Detalle del dia',
        subtitulo: q.fecha.slice(0, 10),
        separador: q.sep,
      },
    );
  }

  /**
   * Serializa al formato pedido y prepara la descarga.
   *
   * El CSV es de una sola tabla por naturaleza: cuando hay varias secciones
   * se exporta la primera, que es la principal. Excel y PDF si las llevan
   * todas.
   */
  private async entregar(
    res: Response,
    formato: FormatoExportacion,
    nombreArchivo: string,
    secciones: Seccion<Fila>[],
    opciones: { titulo: string; subtitulo?: string; separador?: string },
  ): Promise<StreamableFile> {
    let contenido: Buffer;

    if (formato === 'csv') {
      contenido = this.exportacion.aCsv(
        secciones[0].columnas,
        secciones[0].filas,
        opciones.separador ? { separador: opciones.separador } : undefined,
      );
    } else if (formato === 'xlsx') {
      contenido = await this.exportacion.aExcel(secciones);
    } else {
      contenido = await this.exportacion.aPdf({
        titulo: opciones.titulo,
        subtitulo: opciones.subtitulo,
        secciones,
      });
    }

    prepararDescarga(res, nombreArchivo, formato);
    return new StreamableFile(contenido);
  }
}
