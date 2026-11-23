import { DateTime } from 'luxon';

/**
 * Contratos y calculos del calendario.
 *
 * La aritmetica de fechas usa Luxon con la zona fijada: las semanas del mes, la
 * ventana horaria y la posicion de cada barra dependen del dia local, y hacerlo
 * con `Date` obliga a razonar sobre el desfase del navegador, que no tiene por
 * que coincidir con el del trabajador.
 *
 * La rejilla (meses, semanas, "hoy") va en la zona de quien mira; las horas de
 * cada trabajador, en la zona de ese trabajador, que es en la que la API ya
 * agrupo sus dias.
 */
import { zonaActual } from './zona';

export { zonaActual };

// ------------------------------------------------------------------ contratos

export interface TrabajadorRef {
  id: string;
  nombre: string;
  /** Zona en que trabaja: sus dias y sus horas se leen en ella. */
  zonaHoraria: string;
}

export interface AlertasDia {
  jornadasAbiertas: number;
  autocerradas: number;
  inconclusas: number;
  presenciaExcesiva: number;
  horasExcesivas?: number;
  total: number;
}

export interface DiaResumen {
  fecha: string;
  segundosImputados: number;
  segundosPresencia: number;
  sesiones: number;
  conRegistro: number;
  alertas: AlertasDia;
}

export interface CeldaResumen {
  fecha: string;
  trabajadorId: string;
  trabajador: string;
  segundosImputados: number;
  segundosPresencia: number;
  sesiones: number;
  jornadasAbiertas: number;
  autocerradas: number;
  inconclusas: number;
  presenciaExcesiva: boolean;
}

export interface Resumen {
  desde: string;
  hasta: string;
  trabajadores: TrabajadorRef[];
  celdas: CeldaResumen[];
  dias: DiaResumen[];
}

export interface TramoDetalle {
  inicioEn: string;
  terminoEn: string | null;
}

export interface SesionDetalle {
  id: string;
  actividad: string;
  proyecto: string;
  estado: string;
  desenlace: string | null;
  notaCierre: string | null;
  cerradaAutomaticamente: boolean;
  inicioEn: string;
  terminoEn: string | null;
  segundos: number;
  tramos: TramoDetalle[];
}

export interface JornadaDetalle {
  id: string;
  inicioEn: string;
  terminoEn: string | null;
  estado: string;
  cerradaAutomaticamente: boolean;
  segundos: number;
}

export interface TrabajadorDia {
  id: string;
  nombre: string;
  zonaHoraria: string;
  jornada: JornadaDetalle | null;
  segundosImputados: number;
  segundosPresencia: number;
  sesiones: SesionDetalle[];
}

export interface DiaDetalle {
  fecha: string;
  resumen: {
    segundosImputados: number;
    segundosPresencia: number;
    sesiones: number;
    conRegistro: number;
  };
  trabajadores: TrabajadorDia[];
}

export interface Detalle {
  desde: string;
  hasta: string;
  trabajadores: TrabajadorRef[];
  dias: DiaDetalle[];
}

export type Vista = 'rejilla' | 'matriz' | 'semana';

// --------------------------------------------------------------- escala color

export interface TramoEscala {
  clase: string;
  etiqueta: string;
  muestra: string;
}

/**
 * Escala de volumen de horas por persona. Es fija y absoluta a proposito.
 *
 * El heatmap anterior normalizaba contra el maximo del mes, de modo que el
 * mismo dia de cuatro horas se veia oscuro en un mes flojo y claro en uno
 * intenso: el color no significaba nada y dos meses no eran comparables. Aqui
 * el corte esta en horas reales, y no mide cumplimiento —el trabajador es
 * freelance y no tiene horario que cumplir— sino cuanto trabajo hubo.
 */
export const ESCALA: (TramoEscala & { hasta: number })[] = [
  { hasta: 2, clase: 'bg-emerald-100 text-emerald-900', etiqueta: 'hasta 2 h', muestra: 'bg-emerald-100' },
  { hasta: 4, clase: 'bg-emerald-300 text-emerald-950', etiqueta: '2 a 4 h', muestra: 'bg-emerald-300' },
  { hasta: 6, clase: 'bg-emerald-500 text-white', etiqueta: '4 a 6 h', muestra: 'bg-emerald-500' },
  { hasta: 8, clase: 'bg-emerald-600 text-white', etiqueta: '6 a 8 h', muestra: 'bg-emerald-600' },
  { hasta: Infinity, clase: 'bg-emerald-800 text-white', etiqueta: 'más de 8 h', muestra: 'bg-emerald-800' },
];

export const SIN_REGISTRO: TramoEscala = {
  clase: 'bg-white/5 text-slate-500',
  etiqueta: 'sin registro',
  muestra: 'bg-white/5 border border-dashed border-white/15',
};

export function tramoEscala(segundosPorPersona: number): TramoEscala {
  if (segundosPorPersona <= 0) return SIN_REGISTRO;
  const horas = segundosPorPersona / 3600;
  return ESCALA.find((e) => horas <= e.hasta) ?? ESCALA[ESCALA.length - 1];
}

/**
 * Horas por persona de un dia.
 *
 * Se divide entre quienes registraron algo, no entre el equipo completo: asi la
 * escala significa lo mismo con dos trabajadores que con veinte, y un dia con
 * mas gente no se ve automaticamente mas oscuro.
 */
export function porPersona(dia: DiaResumen): number {
  return dia.conRegistro > 0 ? dia.segundosImputados / dia.conRegistro : 0;
}

// ------------------------------------------------------------------- calendario

export interface CeldaMes {
  fecha: string;
  numero: number;
  delMes: boolean;
  finDeSemana: boolean;
  hoy: boolean;
}

export function hoyLocal(): string {
  return DateTime.now().setZone(zonaActual()).toFormat('yyyy-MM-dd');
}

/** Primer dia del mes indicado como `AAAA-MM`; el actual si el valor no sirve. */
export function mesDesde(valor: string | null): DateTime {
  const base = valor
    ? DateTime.fromFormat(valor, 'yyyy-MM', { zone: zonaActual() })
    : DateTime.now().setZone(zonaActual());
  return (base.isValid ? base : DateTime.now().setZone(zonaActual())).startOf('month');
}

export function claveMes(mes: DateTime): string {
  return mes.toFormat('yyyy-MM');
}

/** Rango de dias locales que cubre el mes completo. */
export function rangoDelMes(mes: DateTime): { desde: string; hasta: string } {
  return {
    desde: mes.startOf('month').toFormat('yyyy-MM-dd'),
    hasta: mes.endOf('month').toFormat('yyyy-MM-dd'),
  };
}

/** Lunes a domingo que contiene al dia indicado. */
export function rangoDeSemana(fecha: string): { desde: string; hasta: string } {
  const d = DateTime.fromISO(fecha, { zone: zonaActual() });
  const base = d.isValid ? d : DateTime.now().setZone(zonaActual());
  return {
    desde: base.startOf('week').toFormat('yyyy-MM-dd'),
    hasta: base.endOf('week').toFormat('yyyy-MM-dd'),
  };
}

/**
 * Celdas de la rejilla mensual, en semanas completas que parten el lunes. Los
 * dias de relleno pertenecen al mes vecino y se pintan atenuados en vez de
 * dejarse en blanco: asi la rejilla no tiene huecos y la fila siempre cuadra.
 */
export function celdasDelMes(mes: DateTime): CeldaMes[] {
  const primero = mes.startOf('month').startOf('week');
  const ultimo = mes.endOf('month').endOf('week');
  const hoy = hoyLocal();

  const celdas: CeldaMes[] = [];
  for (let d = primero; d <= ultimo; d = d.plus({ days: 1 })) {
    const fecha = d.toFormat('yyyy-MM-dd');
    celdas.push({
      fecha,
      numero: d.day,
      delMes: d.month === mes.month && d.year === mes.year,
      finDeSemana: d.weekday >= 6,
      hoy: fecha === hoy,
    });
  }
  return celdas;
}

/** Dias del rango, en orden. */
export function diasEntre(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  let d = DateTime.fromISO(desde, { zone: zonaActual() });
  const fin = DateTime.fromISO(hasta, { zone: zonaActual() });
  while (d <= fin) {
    dias.push(d.toFormat('yyyy-MM-dd'));
    d = d.plus({ days: 1 });
  }
  return dias;
}

// -------------------------------------------------------------- linea de tiempo

/**
 * Hora del dia, en horas decimales, de un instante respecto del dia local
 * indicado. Se recorta a [0, 24] para que una sesion que cruza medianoche
 * —habitual en trabajo freelance— dibuje su barra hasta el borde y no fuera.
 */
export function horaDelDia(iso: string, fecha: string, zona: string = zonaActual()): number {
  const punto = DateTime.fromISO(iso, { zone: zona });
  const base = DateTime.fromISO(fecha, { zone: zona }).startOf('day');
  return Math.min(24, Math.max(0, punto.diff(base, 'hours').hours));
}

/**
 * Ventana horaria que encuadra la actividad del rango.
 *
 * Se ajusta a los datos en vez de fijar 09:00 a 17:00: un freelance trabaja a
 * cualquier hora y un eje fijo recortaria las tandas nocturnas. Se garantiza un
 * ancho minimo para que un dia de una sola sesion corta no salga desproporcionado.
 */
export function ventanaHoraria(dias: DiaDetalle[]): { desde: number; hasta: number } {
  const ANCHO_MINIMO = 8;
  let minimo = 24;
  let maximo = 0;
  let hay = false;

  for (const dia of dias) {
    for (const t of dia.trabajadores) {
      const rangos: TramoDetalle[] = t.sesiones.flatMap((s) => s.tramos);
      if (t.jornada) rangos.push({ inicioEn: t.jornada.inicioEn, terminoEn: t.jornada.terminoEn });

      for (const r of rangos) {
        hay = true;
        minimo = Math.min(minimo, horaDelDia(r.inicioEn, dia.fecha, t.zonaHoraria));
        maximo = Math.max(maximo, r.terminoEn ? horaDelDia(r.terminoEn, dia.fecha, t.zonaHoraria) : 24);
      }
    }
  }

  if (!hay) return { desde: 8, hasta: 20 };

  let desde = Math.max(0, Math.floor(minimo));
  let hasta = Math.min(24, Math.ceil(maximo));

  while (hasta - desde < ANCHO_MINIMO) {
    if (hasta < 24) hasta += 1;
    else if (desde > 0) desde -= 1;
    else break;
  }

  return { desde, hasta };
}

/** Posicion y ancho en porcentaje de un rango dentro de la ventana horaria. */
export function barra(
  inicio: number,
  fin: number,
  ventana: { desde: number; hasta: number },
): { left: string; width: string } | null {
  const ancho = ventana.hasta - ventana.desde;
  if (ancho <= 0) return null;

  const a = Math.max(inicio, ventana.desde);
  const b = Math.min(fin, ventana.hasta);
  if (b <= a) return null;

  return {
    left: `${((a - ventana.desde) / ancho) * 100}%`,
    // Un tramo de pocos minutos seria invisible: se le da un ancho minimo.
    width: `${Math.max(((b - a) / ancho) * 100, 0.6)}%`,
  };
}

/**
 * Margen de presencia sin imputar a partir del cual el dia se marca. Debe
 * coincidir con MARGEN_PRESENCIA de CalendarioService: si divergen, la alerta
 * del calendario y la del panel del dia dirian cosas distintas del mismo dia.
 */
export const MARGEN_PRESENCIA = 90 * 60;
