import { Workbook } from 'exceljs';
import { ExportacionService } from '../../../src/common/exportacion/exportacion.service';
import { Columna } from '../../../src/common/exportacion/columna';

type Fila = Record<string, unknown>;

const COLUMNAS: Columna<Fila>[] = [
  { clave: 'trabajador', titulo: 'Trabajador' },
  { clave: 'segundos', titulo: 'Horas', formato: 'duracion' },
  { clave: 'promedio', titulo: 'Promedio', formato: 'numero' },
  { clave: 'sesiones', titulo: 'Sesiones', formato: 'entero' },
];

describe('ExportacionService', () => {
  let servicio: ExportacionService;

  beforeEach(() => {
    servicio = new ExportacionService();
  });

  describe('aCsv', () => {
    const csv = (columnas: Columna<Fila>[], filas: Fila[], sep?: string) =>
      servicio.aCsv(columnas, filas, sep ? { separador: sep } : undefined).toString('utf8');

    it('ABRE BIEN EN EXCEL: empieza con el BOM UTF-8', () => {
      const salida = csv(COLUMNAS, []);

      // Sin el BOM, Excel en espanol rompe los acentos.
      expect(salida.charCodeAt(0)).toBe(0xfeff);
    });

    it('separa con punto y coma por defecto (locale es-CL)', () => {
      const salida = csv(COLUMNAS, []);

      expect(salida).toContain('Trabajador;Horas;Promedio;Sesiones');
    });

    it('conserva los acentos', () => {
      const salida = csv(
        [{ clave: 'nombre', titulo: 'Nombre' }],
        [{ nombre: 'Ramírez Muñoz' }],
      );

      expect(salida).toContain('Ramírez Muñoz');
    });

    it('permite pedir la coma como separador', () => {
      const salida = csv(COLUMNAS, [], ',');

      expect(salida).toContain('Trabajador,Horas,Promedio,Sesiones');
    });

    it('entrecomilla un valor que contiene el separador', () => {
      const salida = csv(
        [{ clave: 'nombre', titulo: 'Nombre' }],
        [{ nombre: 'Perez; Ana' }],
      );

      expect(salida).toContain('"Perez; Ana"');
    });

    it('duplica las comillas internas (RFC 4180)', () => {
      const salida = csv(
        [{ clave: 'nombre', titulo: 'Nombre' }],
        [{ nombre: 'Ana "La Jefa"' }],
      );

      expect(salida).toContain('"Ana ""La Jefa"""');
    });

    it('entrecomilla un valor con salto de linea', () => {
      const salida = csv(
        [{ clave: 'nota', titulo: 'Nota' }],
        [{ nota: 'primera\nsegunda' }],
      );

      expect(salida).toContain('"primera\nsegunda"');
    });

    it('null y undefined salen vacios, nunca como el texto "null"', () => {
      const salida = csv(
        [
          { clave: 'a', titulo: 'A' },
          { clave: 'b', titulo: 'B' },
        ],
        [{ a: null, b: undefined }],
      );

      expect(salida).not.toContain('null');
      expect(salida).not.toContain('undefined');
      expect(salida.split('\r\n')[1]).toBe(';');
    });

    it('formatea la duracion como HH:MM:SS', () => {
      const salida = csv(
        [{ clave: 's', titulo: 'S', formato: 'duracion' }],
        [{ s: 3661 }],
      );

      expect(salida).toContain('01:01:01');
    });

    it('una duracion mayor a un dia no reinicia las horas', () => {
      const salida = csv(
        [{ clave: 's', titulo: 'S', formato: 'duracion' }],
        [{ s: 90000 }], // 25 horas
      );

      expect(salida).toContain('25:00:00');
    });

    it('los numeros usan coma decimal', () => {
      const salida = csv(
        [{ clave: 'n', titulo: 'N', formato: 'numero' }],
        [{ n: 3.5 }],
      );

      expect(salida).toContain('3,50');
    });

    it('sin filas devuelve solo el encabezado, sin lanzar', () => {
      const salida = csv(COLUMNAS, []);

      expect(salida.split('\r\n')).toHaveLength(1);
    });
  });

  describe('aExcel', () => {
    it('produce un archivo zip valido (los xlsx empiezan con PK)', async () => {
      const buffer = await servicio.aExcel([
        { nombre: 'Horas', columnas: COLUMNAS, filas: [] },
      ]);

      expect(buffer.subarray(0, 2).toString('latin1')).toBe('PK');
    });

    it('crea una pestana por seccion y se puede releer', async () => {
      const buffer = await servicio.aExcel([
        { nombre: 'Por trabajador', columnas: COLUMNAS, filas: [] },
        { nombre: 'Por actividad', columnas: COLUMNAS, filas: [] },
      ]);

      const libro = new Workbook();
      await libro.xlsx.load(buffer as never);

      expect(libro.worksheets.map((h) => h.name)).toEqual([
        'Por trabajador',
        'Por actividad',
      ]);
    });

    it('SUMABLE EN LA HOJA: la duracion va en horas decimales, no en texto', async () => {
      const buffer = await servicio.aExcel([
        {
          nombre: 'Horas',
          columnas: [{ clave: 'segundos', titulo: 'Horas', formato: 'duracion' }],
          filas: [{ segundos: 5400 }], // 1,5 horas
        },
      ]);

      const libro = new Workbook();
      await libro.xlsx.load(buffer as never);
      const celda = libro.worksheets[0].getCell('A2');

      expect(celda.value).toBe(1.5);
      expect(typeof celda.value).toBe('number');
    });

    it('sanea un nombre de hoja invalido para Excel', async () => {
      const buffer = await servicio.aExcel([
        { nombre: 'Reporte 2026/09 [final]', columnas: COLUMNAS, filas: [] },
      ]);

      const libro = new Workbook();
      await libro.xlsx.load(buffer as never);

      expect(libro.worksheets[0].name).toBe('Reporte 2026-09 -final-');
    });
  });

  describe('aPdf', () => {
    it('produce un PDF valido', async () => {
      const buffer = await servicio.aPdf({
        titulo: 'Reporte de horas',
        subtitulo: 'Periodo de prueba',
        secciones: [{ nombre: 'Por trabajador', columnas: COLUMNAS, filas: [] }],
      });

      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(buffer.length).toBeGreaterThan(500);
    });

    it('pagina sin romperse con muchas filas', async () => {
      const filas = Array.from({ length: 120 }, (_, i) => ({
        trabajador: `Trabajador ${i}`,
        segundos: i * 60,
        promedio: i,
        sesiones: i,
      }));

      const buffer = await servicio.aPdf({
        titulo: 'Reporte extenso',
        secciones: [{ nombre: 'Por trabajador', columnas: COLUMNAS, filas }],
      });

      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });
  });
});
