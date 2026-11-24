jest.mock('@/lib/zona', () => ({
  zonaActual: () => 'UTC',
}));

import {
  colorAvatarDe,
  cronometro,
  duracion,
  ESTADOS,
  estadoDeActividad,
  etiquetaEntidad,
  etiquetaPlan,
  etiquetaRol,
  horasBreves,
  iniciales,
  tiempoRelativo,
  vencimientoRelativo,
} from '@/lib/formato';

describe('Utilidades de formato y lectura humana', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('cronometro formatea HH:MM:SS incluyendo horas > 24 y valores negativos en 0', () => {
    expect(cronometro(0)).toBe('00:00:00');
    expect(cronometro(-15)).toBe('00:00:00');
    expect(cronometro(3661.9)).toBe('01:01:01');
    expect(cronometro(90061)).toBe('25:01:01');
  });

  it('duracion expresa segundos, minutos y horas de forma breve', () => {
    expect(duracion(0)).toBe('sin registro');
    expect(duracion(-5)).toBe('sin registro');
    expect(duracion(45)).toBe('45 s');
    expect(duracion(900)).toBe('15 min');
    expect(duracion(7200)).toBe('2 h');
    expect(duracion(8100)).toBe('2 h 15 min');
  });

  it('estadoDeActividad, etiquetas y avatares manejan valores conocidos y fallback seguro', () => {
    expect(estadoDeActividad('COMPLETADA')).toBe(ESTADOS.COMPLETADA);
    expect(estadoDeActividad('DESCONOCIDO')).toBe(ESTADOS.PENDIENTE);

    expect(etiquetaRol('ADMINISTRADOR')).toBe('Administrador');
    expect(etiquetaRol(null)).toBe('Equipo');
    expect(etiquetaRol('EXTERNO')).toBe('EXTERNO');

    expect(etiquetaPlan(undefined)).toBe('Básico');
    expect(etiquetaPlan('EMPRESA')).toBe('Empresa');
    expect(etiquetaPlan('VIP')).toBe('VIP');

    expect(etiquetaEntidad('Actividad')).toBe('Tarea');
    expect(etiquetaEntidad('Otro')).toBe('Otro');

    expect(iniciales('Ana Maria Lopez')).toBe('AM');
    expect(colorAvatarDe('u-123')).toBe(colorAvatarDe('u-123'));
    expect(colorAvatarDe('u-123')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(horasBreves(23400)).toBe('6,5 h');
  });

  it('tiempoRelativo clasifica segundos, minutos, horas, ayer, dias e ISO invalido', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-24T12:00:00Z'));

    expect(tiempoRelativo('2026-11-24T11:59:30Z')).toBe('Hace un momento');
    expect(tiempoRelativo('2026-11-24T11:55:00Z')).toBe('Hace 5 min');
    expect(tiempoRelativo('2026-11-24T09:00:00Z')).toBe('Hace 3 h');
    expect(tiempoRelativo('2026-11-23T12:00:00Z')).toBe('Ayer');
    expect(tiempoRelativo('2026-11-20T12:00:00Z')).toBe('Hace 4 días');
    expect(tiempoRelativo('fecha-invalida')).toBe('fecha-invalida');
  });

  it('vencimientoRelativo distingue completadas, hoy, manana, proximas y vencidas', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-24T15:00:00Z'));

    expect(vencimientoRelativo(null)).toBeNull();
    expect(vencimientoRelativo('2026-11-20T12:00:00Z', true)).toEqual({
      texto: expect.stringContaining('Cerrada (límite'),
      tono: 'ok',
    });
    expect(vencimientoRelativo('2026-11-24T23:00:00Z')).toEqual({
      texto: 'Vence hoy',
      tono: 'alerta',
    });
    expect(vencimientoRelativo('2026-11-25T10:00:00Z')).toEqual({
      texto: 'Vence mañana',
      tono: 'alerta',
    });
    expect(vencimientoRelativo('2026-11-28T10:00:00Z')).toEqual({
      texto: 'Vence en 4 días',
      tono: 'neutro',
    });
    expect(vencimientoRelativo('2026-12-10T10:00:00Z')).toEqual({
      texto: expect.stringMatching(/^Vence el /),
      tono: 'neutro',
    });
    expect(vencimientoRelativo('2026-11-23T10:00:00Z')).toEqual({
      texto: 'Venció ayer',
      tono: 'peligro',
    });
    expect(vencimientoRelativo('2026-11-19T10:00:00Z')).toEqual({
      texto: 'Vencida hace 5 días',
      tono: 'peligro',
    });
  });
});
