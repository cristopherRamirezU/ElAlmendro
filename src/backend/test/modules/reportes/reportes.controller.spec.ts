import { Test } from '@nestjs/testing';
import { ReportesController } from '../../../src/modules/reportes/reportes.controller';
import { ReportesService } from '../../../src/modules/reportes/reportes.service';
import { ExportacionService } from '../../../src/common/exportacion/exportacion.service';
import { PERMISOS } from '../../../src/common/rbac';
import { UsuarioActual } from '../../../src/common/usuario-actual.decorator';
import { JwtAuthGuard } from '../../../src/common/jwt-auth.guard';
import { PermisosGuard } from '../../../src/common/guards/permisos.guard';

/**
 * Lo que se prueba aqui no es el SQL (eso vive en Postgres), sino QUIEN ve
 * los datos de quien. Un descuido al copiar el handler JSON al de exportacion
 * convertiria la descarga en una fuga de los datos de todo el equipo.
 */

const usuario = (rol: string, permisos: string[] = []): UsuarioActual =>
  ({
    id: 'usuario-1',
    email: 'a@b.cl',
    nombreCompleto: 'Ana',
    rol,
    permisos,
    organizacionId: 'org-1',
  }) as UsuarioActual;

const TRABAJADOR = usuario('TRABAJADOR');
const ADMIN = usuario('ADMINISTRADOR');
const SUPERVISOR = usuario('SUPERVISOR');
const CON_PERMISO = usuario('TRABAJADOR', [PERMISOS.REPORTES_VER_EQUIPO]);

/** Respuesta de Express suficiente para capturar las cabeceras. */
const respuestaFalsa = () => {
  const cabeceras: Record<string, string> = {};
  return {
    cabeceras,
    res: {
      set: (h: Record<string, string>) => Object.assign(cabeceras, h),
    } as never,
  };
};

const PERIODO = {
  desde: '2026-09-01T00:00:00.000Z',
  hasta: '2026-09-22T00:00:00.000Z',
};

describe('ReportesController', () => {
  let controller: ReportesController;
  let reportes: {
    calendario: jest.Mock;
    dia: jest.Mock;
    porTrabajador: jest.Mock;
    porActividad: jest.Mock;
  };

  beforeEach(async () => {
    reportes = {
      calendario: jest.fn().mockResolvedValue([]),
      dia: jest.fn().mockResolvedValue([]),
      porTrabajador: jest.fn().mockResolvedValue([]),
      porActividad: jest.fn().mockResolvedValue([]),
    };

    const modulo = await Test.createTestingModule({
      controllers: [ReportesController],
      providers: [
        { provide: ReportesService, useValue: reportes },
        ExportacionService,
      ],
    })
      // Se invocan los metodos del controller directamente, asi que los
      // guards no intervienen; cada uno tiene su propio spec.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermisosGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = modulo.get(ReportesController);
  });

  describe('alcance de la exportacion de calendario', () => {
    it('UN TRABAJADOR SOLO EXPORTA LO SUYO: se filtra por su propio id', async () => {
      const { res } = respuestaFalsa();

      await controller.exportarCalendario(
        TRABAJADOR,
        { ...PERIODO, formato: 'csv' },
        res,
      );

      const [, , usuarioId] = reportes.calendario.mock.calls[0];
      expect(usuarioId).toBe(TRABAJADOR.id);
    });

    it('un ADMINISTRADOR exporta a todo el equipo (sin filtro)', async () => {
      const { res } = respuestaFalsa();

      await controller.exportarCalendario(
        ADMIN,
        { ...PERIODO, formato: 'csv' },
        res,
      );

      expect(reportes.calendario.mock.calls[0][2]).toBeUndefined();
    });

    it('un SUPERVISOR tambien exporta a todo el equipo', async () => {
      const { res } = respuestaFalsa();

      await controller.exportarCalendario(
        SUPERVISOR,
        { ...PERIODO, formato: 'csv' },
        res,
      );

      expect(reportes.calendario.mock.calls[0][2]).toBeUndefined();
    });

    it('el permiso manda sobre el rol: TRABAJADOR con REPORTES_VER_EQUIPO ve todo', async () => {
      const { res } = respuestaFalsa();

      await controller.exportarCalendario(
        CON_PERMISO,
        { ...PERIODO, formato: 'csv' },
        res,
      );

      expect(reportes.calendario.mock.calls[0][2]).toBeUndefined();
    });

    it('SIMETRIA: la exportacion aplica el mismo alcance que el endpoint JSON', async () => {
      const { res } = respuestaFalsa();

      await controller.calendario(TRABAJADOR, PERIODO.desde, PERIODO.hasta);
      const alcanceJson = reportes.calendario.mock.calls[0][2];

      await controller.exportarCalendario(
        TRABAJADOR,
        { ...PERIODO, formato: 'csv' },
        res,
      );
      const alcanceExportacion = reportes.calendario.mock.calls[1][2];

      // Si alguien toca uno de los dos y olvida el otro, este test cae.
      expect(alcanceExportacion).toBe(alcanceJson);
    });
  });

  describe('alcance de la exportacion del dia', () => {
    it('un TRABAJADOR solo ve sus propias sesiones', async () => {
      const { res } = respuestaFalsa();

      await controller.exportarDia(
        TRABAJADOR,
        { fecha: '2026-09-22', formato: 'csv' },
        res,
      );

      expect(reportes.dia).toHaveBeenCalledWith('2026-09-22', TRABAJADOR.id, 'org-1');
    });

    it('un ADMINISTRADOR ve las de todos', async () => {
      const { res } = respuestaFalsa();

      await controller.exportarDia(
        ADMIN,
        { fecha: '2026-09-22', formato: 'csv' },
        res,
      );

      expect(reportes.dia).toHaveBeenCalledWith('2026-09-22', undefined, 'org-1');
    });
  });

  describe('alcance por organizacion (Multi-SaaS)', () => {
    it('un ADMINISTRADOR queda encerrado en su propia organizacion', async () => {
      const { res } = respuestaFalsa();

      // Aunque pida otra empresa a mano, se ignora: manda la suya.
      await controller.exportarPeriodo(
        ADMIN,
        { ...PERIODO, formato: 'csv', organizacionId: 'empresa-ajena' },
        res,
      );

      expect(reportes.porTrabajador.mock.calls[0][2]).toBe('org-1');
    });

    it('un SUPER_ADMIN si puede exportar la organizacion que pida', async () => {
      const { res } = respuestaFalsa();
      const superAdmin = usuario('SUPER_ADMIN');

      await controller.exportarPeriodo(
        superAdmin,
        { ...PERIODO, formato: 'csv', organizacionId: 'empresa-b' },
        res,
      );

      expect(reportes.porTrabajador.mock.calls[0][2]).toBe('empresa-b');
    });

    it('un SUPER_ADMIN sin filtro exporta el consolidado global', async () => {
      const { res } = respuestaFalsa();

      await controller.exportarPeriodo(
        usuario('SUPER_ADMIN'),
        { ...PERIODO, formato: 'csv' },
        res,
      );

      expect(reportes.porTrabajador.mock.calls[0][2]).toBeNull();
    });
  });

  describe('cabeceras de descarga', () => {
    it.each([
      ['csv', 'text/csv; charset=utf-8'],
      ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['pdf', 'application/pdf'],
    ])('el formato %s declara su tipo de contenido', async (formato, mime) => {
      const { res, cabeceras } = respuestaFalsa();

      await controller.exportarPeriodo(
        ADMIN,
        { ...PERIODO, formato: formato as 'csv' | 'xlsx' | 'pdf' },
        res,
      );

      expect(cabeceras['Content-Type']).toBe(mime);
      expect(cabeceras['Content-Disposition']).toContain('attachment');
      expect(cabeceras['Content-Disposition']).toContain(`.${formato}"`);
    });

    it('el nombre del archivo lleva el rango de fechas', async () => {
      const { res, cabeceras } = respuestaFalsa();

      await controller.exportarPeriodo(ADMIN, { ...PERIODO, formato: 'csv' }, res);

      expect(cabeceras['Content-Disposition']).toContain(
        'timeflow-horas_2026-09-01_2026-09-22.csv',
      );
    });
  });

  describe('contenido', () => {
    it('el periodo consulta las dos tablas del reporte', async () => {
      const { res } = respuestaFalsa();

      await controller.exportarPeriodo(ADMIN, { ...PERIODO, formato: 'xlsx' }, res);

      expect(reportes.porTrabajador).toHaveBeenCalled();
      expect(reportes.porActividad).toHaveBeenCalled();
    });

    it('el csv respeta el separador pedido', async () => {
      const { res } = respuestaFalsa();
      reportes.porTrabajador.mockResolvedValue([
        { trabajador: 'Ana', segundos: 3600, dias: 1, sesiones: 2, actividades: 1 },
      ]);

      const archivo = await controller.exportarPeriodo(
        ADMIN,
        { ...PERIODO, formato: 'csv', sep: ',' },
        res,
      );

      expect(archivo.getStream().read().toString('utf8')).toContain(
        'Trabajador,Horas,Dias,Sesiones,Actividades',
      );
    });
  });
});
