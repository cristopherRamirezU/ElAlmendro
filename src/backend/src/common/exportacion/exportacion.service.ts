import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import PDFDocument from 'pdfkit';
import { Columna, FormatoColumna, Seccion } from './columna';

/**
 * Separador por defecto de los CSV.
 *
 * En un Windows con locale es-CL el separador de lista es ';'. Si se usara la
 * coma, Excel dejaria toda la fila dentro de la columna A. Se puede pedir la
 * coma con ?sep=, para quien abra el archivo con otra herramienta.
 */
export const SEPARADOR_CSV = ';';

/**
 * Marca de orden de bytes UTF-8.
 *
 * Sin ella Excel abre el archivo con la codificacion ANSI del sistema y los
 * acentos se rompen ("Ramirez" sale mal). Es el error mas comun al exportar.
 */
const BOM_UTF8 = '﻿';

@Injectable()
export class ExportacionService {
  // ------------------------------------------------------------------- CSV

  aCsv<T extends Record<string, unknown>>(
    columnas: Columna<T>[],
    filas: T[],
    opciones?: { separador?: string },
  ): Buffer {
    const sep = opciones?.separador || SEPARADOR_CSV;

    const lineas = [
      columnas.map((c) => this.escapar(c.titulo, sep)).join(sep),
      ...filas.map((fila) =>
        columnas
          .map((c) => this.escapar(this.aTexto(fila[c.clave], c.formato), sep))
          .join(sep),
      ),
    ];

    return Buffer.from(BOM_UTF8 + lineas.join('\r\n'), 'utf8');
  }

  // ----------------------------------------------------------------- Excel

  async aExcel<T extends Record<string, unknown>>(
    secciones: Seccion<T>[],
  ): Promise<Buffer> {
    const libro = new Workbook();
    libro.creator = 'TimeFlow';
    libro.created = new Date();

    for (const seccion of secciones) {
      const hoja = libro.addWorksheet(this.nombreHojaValido(seccion.nombre));

      hoja.columns = seccion.columnas.map((c) => ({
        header: c.titulo,
        key: c.clave,
        width: c.ancho ?? 22,
      }));

      hoja.getRow(1).font = { bold: true };

      for (const fila of seccion.filas) {
        hoja.addRow(
          Object.fromEntries(
            seccion.columnas.map((c) => [
              c.clave,
              this.aValorExcel(fila[c.clave], c.formato),
            ]),
          ),
        );
      }

      // Las duraciones van como horas decimales: se dejan con dos decimales
      // para que la hoja pueda sumarlas.
      seccion.columnas.forEach((c, i) => {
        if (c.formato === 'duracion') {
          hoja.getColumn(i + 1).numFmt = '0.00';
        }
      });

      hoja.views = [{ state: 'frozen', ySplit: 1 }];
    }

    return Buffer.from(await libro.xlsx.writeBuffer());
  }

  // ------------------------------------------------------------------- PDF

  async aPdf<T extends Record<string, unknown>>(doc: {
    titulo: string;
    subtitulo?: string;
    secciones: Seccion<T>[];
  }): Promise<Buffer> {
    const pdf = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 36,
    });

    const trozos: Buffer[] = [];
    pdf.on('data', (t: Buffer) => trozos.push(t));
    const terminado = new Promise<void>((listo) => pdf.on('end', () => listo()));

    pdf.fontSize(18).text(doc.titulo);
    if (doc.subtitulo) {
      pdf.moveDown(0.2).fontSize(10).fillColor('#555').text(doc.subtitulo);
    }
    pdf.fillColor('#000').moveDown(1);

    for (const seccion of doc.secciones) {
      this.tablaPdf(pdf, seccion);
      pdf.moveDown(1.5);
    }

    pdf.end();
    await terminado;
    return Buffer.concat(trozos);
  }

  /** Dibuja una tabla con encabezado repetido en cada pagina nueva. */
  private tablaPdf<T extends Record<string, unknown>>(
    pdf: PDFKit.PDFDocument,
    seccion: Seccion<T>,
  ): void {
    const izquierda = pdf.page.margins.left;
    const util =
      pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;
    const pesoTotal = seccion.columnas.reduce((s, c) => s + (c.ancho ?? 22), 0);
    const anchos = seccion.columnas.map(
      (c) => ((c.ancho ?? 22) / pesoTotal) * util,
    );

    const ALTO = 16;

    const encabezado = () => {
      pdf.fontSize(9).font('Helvetica-Bold');
      let x = izquierda;
      seccion.columnas.forEach((c, i) => {
        pdf.text(c.titulo, x + 2, pdf.y, { width: anchos[i] - 4, ellipsis: true });
        x += anchos[i];
      });
      pdf.moveDown(0.3);
      pdf
        .moveTo(izquierda, pdf.y)
        .lineTo(izquierda + util, pdf.y)
        .strokeColor('#999')
        .stroke();
      pdf.moveDown(0.3);
      pdf.font('Helvetica');
    };

    pdf.fontSize(12).font('Helvetica-Bold').text(seccion.nombre);
    pdf.moveDown(0.4);
    encabezado();

    if (seccion.filas.length === 0) {
      pdf.fontSize(9).fillColor('#777').text('Sin datos en el periodo.');
      pdf.fillColor('#000');
      return;
    }

    for (const fila of seccion.filas) {
      // Salto de pagina con el encabezado repetido.
      if (pdf.y + ALTO > pdf.page.height - pdf.page.margins.bottom) {
        pdf.addPage();
        encabezado();
      }

      const yFila = pdf.y;
      let x = izquierda;
      pdf.fontSize(9);
      seccion.columnas.forEach((c, i) => {
        pdf.text(this.aTexto(fila[c.clave], c.formato), x + 2, yFila, {
          width: anchos[i] - 4,
          ellipsis: true,
          lineBreak: false,
        });
        x += anchos[i];
      });
      pdf.y = yFila + ALTO;
    }
  }

  /**
   * Barras horizontales dibujadas con rectangulos nativos, replicando la
   * geometria del grafico que la interfaz muestra en pantalla.
   */
  graficoBarrasPdf(
    pdf: PDFKit.PDFDocument,
    titulo: string,
    datos: { etiqueta: string; valor: number }[],
  ): void {
    if (datos.length === 0) return;

    pdf.fontSize(12).font('Helvetica-Bold').text(titulo);
    pdf.moveDown(0.5).font('Helvetica');

    const izquierda = pdf.page.margins.left;
    const util =
      pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;
    const anchoEtiqueta = util * 0.3;
    const anchoBarra = util * 0.6;
    const maximo = Math.max(...datos.map((d) => d.valor)) || 1;

    for (const d of datos) {
      if (pdf.y + 18 > pdf.page.height - pdf.page.margins.bottom) pdf.addPage();

      const y = pdf.y;
      pdf
        .fontSize(9)
        .text(d.etiqueta, izquierda, y, {
          width: anchoEtiqueta - 6,
          ellipsis: true,
          lineBreak: false,
        });

      const largo = Math.max(1, (d.valor / maximo) * anchoBarra);
      pdf
        .rect(izquierda + anchoEtiqueta, y - 1, largo, 10)
        .fillColor('#0ea5e9')
        .fill();

      pdf
        .fillColor('#000')
        .text(
          this.aTexto(d.valor, 'duracion'),
          izquierda + anchoEtiqueta + largo + 6,
          y,
          { lineBreak: false },
        );

      pdf.y = y + 16;
    }
  }

  // -------------------------------------------------------------- privados

  /** Comillado RFC 4180. */
  private escapar(valor: string, separador: string): string {
    const debe =
      valor.includes(separador) ||
      valor.includes('"') ||
      valor.includes('\n') ||
      valor.includes('\r');

    return debe ? '"' + valor.replace(/"/g, '""') + '"' : valor;
  }

  private aTexto(valor: unknown, formato: FormatoColumna = 'texto'): string {
    if (valor === null || valor === undefined) return '';

    switch (formato) {
      case 'duracion':
        return this.comoReloj(Number(valor));
      case 'numero':
        // Coma decimal, coherente con el separador ';'.
        return Number(valor).toFixed(2).replace('.', ',');
      case 'entero':
        return String(Math.round(Number(valor)));
      case 'fecha':
        return this.comoFecha(valor);
      default:
        return String(valor);
    }
  }

  private aValorExcel(valor: unknown, formato: FormatoColumna = 'texto'): unknown {
    if (valor === null || valor === undefined) return '';

    switch (formato) {
      // En Excel la duracion va en horas decimales para poder sumarla.
      case 'duracion':
        return Number((Number(valor) / 3600).toFixed(2));
      case 'numero':
        return Number(valor);
      case 'entero':
        return Math.round(Number(valor));
      case 'fecha':
        return valor instanceof Date ? valor : new Date(String(valor));
      default:
        return String(valor);
    }
  }

  /** Segundos a HH:MM:SS. */
  private comoReloj(segundos: number): string {
    if (!Number.isFinite(segundos) || segundos < 0) return '00:00:00';

    const total = Math.round(segundos);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const dosDigitos = (n: number) => String(n).padStart(2, '0');

    return `${dosDigitos(h)}:${dosDigitos(m)}:${dosDigitos(s)}`;
  }

  private comoFecha(valor: unknown): string {
    const fecha = valor instanceof Date ? valor : new Date(String(valor));
    if (Number.isNaN(fecha.getTime())) return String(valor);

    // Se muestra en la zona del negocio, no en la del servidor (que va en UTC).
    return fecha.toLocaleString('es-CL', { timeZone: 'America/Santiago' });
  }

  /** Excel rechaza ciertos caracteres y limita el nombre de hoja a 31. */
  private nombreHojaValido(nombre: string): string {
    return nombre.replace(/[*?:/\\[\]]/g, '-').slice(0, 31) || 'Hoja';
  }
}
