import {
  conLados,
  conPosicion,
  ladosGuardados,
  obtenerDescendientes,
  posicionGuardada,
  validarCambioPadre,
} from '@/lib/mapaMental';
import type { NodoActividad } from '@/lib/tipos';

function nodo(id: string, actividadPadreId: string | null = null): NodoActividad {
  return {
    id,
    titulo: `Tarea ${id}`,
    estado: 'PENDIENTE',
    prioridad: 'MEDIA',
    orden: 1,
    actividadPadreId,
    posicionNodo: null,
    ladosLinea: null,
    fechaLimite: null,
    bloquearOrdenHijas: false,
    responsable: { id: 'u-1', nombreCompleto: 'Ana' },
    monedas: 0,
    monedasListas: 0,
  };
}

describe('Logica pura del mapa mental', () => {
  it('obtenerDescendientes recorre subarboles multinivel y tolera ciclos sin colgarse', () => {
    const lista = [
      nodo('a', null),
      nodo('b', 'a'),
      nodo('c', 'b'),
      nodo('d', 'a'),
      // Ciclo artificial para validar proteccion visitados
      nodo('c', 'a'),
    ];
    const desc = obtenerDescendientes('a', lista);
    expect(desc.has('b')).toBe(true);
    expect(desc.has('c')).toBe(true);
    expect(desc.has('d')).toBe(true);
    expect(obtenerDescendientes('d', lista).size).toBe(0);
  });

  it('validarCambioPadre bloquea autoconexion y ciclos pero permite ramas validas', () => {
    const arbol = [
      nodo('abuelo', null),
      nodo('padre', 'abuelo'),
      nodo('nieto', 'padre'),
      nodo('otra-rama', null),
    ];

    expect(validarCambioPadre('padre', null, arbol)).toEqual({ valido: true });
    expect(validarCambioPadre('padre', 'otra-rama', arbol)).toEqual({ valido: true });

    const auto = validarCambioPadre('padre', 'padre', arbol);
    expect(auto.valido).toBe(false);

    const circular = validarCambioPadre('abuelo', 'nieto', arbol);
    expect(circular.valido).toBe(false);
    if (!circular.valido) {
      expect(circular.motivo).toContain('Dependencia circular');
    }
  });

  it('posicionGuardada y conPosicion preservan y limpian orientaciones independientemente', () => {
    const a = {
      ...nodo('a'),
      posicionNodo: { horizontal: { x: 100, y: 200 }, vertical: { x: 50, y: 300 } },
    };
    expect(posicionGuardada(a, 'horizontal')).toEqual({ x: 100, y: 200 });

    const actualizado = conPosicion(a, 'horizontal', { x: 150, y: 250 });
    expect(actualizado).toEqual({
      horizontal: { x: 150, y: 250 },
      vertical: { x: 50, y: 300 },
    });

    const sinHoriz = conPosicion(a, 'horizontal', null);
    expect(sinHoriz).toEqual({ vertical: { x: 50, y: 300 } });

    const vacio = conPosicion({ ...a, posicionNodo: sinHoriz }, 'vertical', null);
    expect(vacio).toBeNull();
  });

  it('ladosGuardados y conLados filtran valores invalidos y conservan posiciones validas [0,1]', () => {
    const a = {
      ...nodo('a'),
      ladosLinea: {
        horizontal: { salida: 'right', entrada: 'left', salidaPos: 0.4, entradaPos: 1.5 },
        vertical: { salida: 'invalido' },
      },
    };
    expect(ladosGuardados(a, 'horizontal')).toEqual({
      salida: 'right',
      entrada: 'left',
      salidaPos: 0.4,
    });
    expect(ladosGuardados(a, 'vertical')).toEqual({});

    const nuevo = conLados(a, 'vertical', { salida: 'bottom', entrada: 'top', salidaPos: 0.5 });
    expect(nuevo).toEqual({
      horizontal: { salida: 'right', entrada: 'left', salidaPos: 0.4 },
      vertical: { salida: 'bottom', entrada: 'top', salidaPos: 0.5 },
    });

    expect(conLados({ ...a, ladosLinea: { horizontal: { salida: 'right' } } }, 'horizontal', null)).toBeNull();
  });
});
