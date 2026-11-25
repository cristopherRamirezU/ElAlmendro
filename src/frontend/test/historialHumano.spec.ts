jest.mock('@/lib/zona', () => ({
  zonaActual: () => 'UTC',
}));

import { construirDetalleHumano, describirAccionHistorial } from '@/lib/historialHumano';

describe('historialHumano', () => {
  it('traduce cambios de apariencia sin exponer JSON crudo', () => {
    const { resumen, cambios } = construirDetalleHumano('ORGANIZACION_COLOR_ACTUALIZADO', null, {
      temaFondo: 'oscuro-grafito',
      colorPrimario: '#f97316',
    });

    expect(resumen).toContain('apariencia visual');
    expect(cambios).toEqual([
      { etiqueta: 'Tema visual', despues: 'Oscuro Grafito', colorDespues: undefined },
      { etiqueta: 'Color de marca', despues: '#F97316', colorDespues: '#f97316' },
    ]);
    expect(JSON.stringify(cambios)).not.toContain('temaFondo');
  });

  it('compara valorAnterior y valorNuevo en cambios de usuario o plan', () => {
    const { cambios } = construirDetalleHumano(
      'USUARIO_ACTUALIZADO',
      { rol: 'TRABAJADOR', activo: true, nombreCompleto: 'Ana Perez' },
      { rol: 'SUPERVISOR', activo: false, nombreCompleto: 'Ana Perez' },
    );

    expect(cambios).toEqual([
      { etiqueta: 'Rol', antes: 'Trabajador', despues: 'Supervisor' },
      { etiqueta: 'Estado de la cuenta', antes: 'Activado', despues: 'Desactivado' },
    ]);
  });

  it('traduce permisos extra, baja de usuario y omite UUIDs internos', () => {
    const { cambios: permisos } = construirDetalleHumano(
      'USUARIO_PERMISOS',
      { permisosExtra: [] },
      { permisosExtra: ['nodos:editar'] },
    );
    expect(permisos).toEqual([
      { etiqueta: 'Permisos adicionales', antes: 'Ninguno', despues: 'Editar el mapa' },
    ]);

    const { resumen, cambios: miembro } = construirDetalleHumano(
      'PROYECTO_MIEMBRO_AGREGADO',
      null,
      { usuarioId: '11111111-2222-3333-4444-555555555555' },
    );
    expect(resumen).toContain('nuevo integrante');
    expect(miembro).toEqual([]);

    const { cambios: baja } = construirDetalleHumano(
      'USUARIO_ELIMINADO',
      { activo: true, email: 'ana@x.cl' },
      { activo: false, metodo: 'SOFT_DELETE' },
    );
    expect(baja).toEqual(
      expect.arrayContaining([
        { etiqueta: 'Estado de la cuenta', antes: 'Activado', despues: 'Desactivado' },
        { etiqueta: 'Acción aplicada', despues: 'Desactivación de cuenta' },
      ]),
    );
  });

  it('describe acciones de auditoria en lenguaje natural', () => {
    expect(describirAccionHistorial('ACTIVIDAD_BLOQUEO_SECUENCIAL')).toContain('candado secuencial');
    expect(describirAccionHistorial('PROYECTO_ELIMINADO')).toContain('eliminó un proyecto');
  });
});
