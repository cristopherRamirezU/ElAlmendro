import {
  PERMISOS,
  PERMISOS_EXTRA,
  ROLES_PERMISOS,
  ROLES_CATALOGO,
  obtenerPermisosDeRol,
  permisosEfectivos,
  Rol,
} from '../../src/common/rbac';

describe('rbac', () => {
  describe('obtenerPermisosDeRol', () => {
    it('devuelve los permisos exactos del TRABAJADOR', () => {
      expect(obtenerPermisosDeRol('TRABAJADOR')).toEqual([
        PERMISOS.JORNADA_REGISTRAR,
        PERMISOS.SESION_CRONOMETRAR,
        PERMISOS.ACTIVIDADES_VER_PROPIAS,
        PERMISOS.CALENDARIO_VER_PROPIO,
        PERMISOS.NODOS_VER_MAPA,
        PERMISOS.CHAT_USAR,
      ]);
    });

    it.each([
      ['nulo', null],
      ['indefinido', undefined],
      ['cadena vacia', ''],
      ['rol inexistente', 'INEXISTENTE'],
      ['minusculas', 'administrador'],
    ])('devuelve lista vacia con %s', (_caso, entrada) => {
      expect(obtenerPermisosDeRol(entrada as string | null | undefined)).toEqual([]);
    });

    it('devuelve una copia: mutarla no altera la matriz original', () => {
      const permisos = obtenerPermisosDeRol('TRABAJADOR');
      const cantidadOriginal = ROLES_PERMISOS.TRABAJADOR.length;

      permisos.push(PERMISOS.USUARIOS_GESTIONAR);

      expect(ROLES_PERMISOS.TRABAJADOR).toHaveLength(cantidadOriginal);
      expect(ROLES_PERMISOS.TRABAJADOR).not.toContain(PERMISOS.USUARIOS_GESTIONAR);
    });
  });

  describe('matriz de permisos', () => {
    it('el TRABAJADOR no accede a datos de equipo ni a usuarios', () => {
      const permisos = ROLES_PERMISOS.TRABAJADOR;

      expect(permisos).not.toContain(PERMISOS.ACTIVIDADES_VER_TODAS);
      expect(permisos).not.toContain(PERMISOS.REPORTES_VER_EQUIPO);
      expect(permisos).not.toContain(PERMISOS.CALENDARIO_VER_EQUIPO);
      expect(permisos).not.toContain(PERMISOS.USUARIOS_VER);
      expect(permisos).not.toContain(PERMISOS.USUARIOS_GESTIONAR);
    });

    it('todo permiso del SUPERVISOR lo tiene tambien el ADMINISTRADOR', () => {
      const admin = new Set<string>(ROLES_PERMISOS.ADMINISTRADOR);
      const faltantes = ROLES_PERMISOS.SUPERVISOR.filter((p) => !admin.has(p));

      expect(faltantes).toEqual([]);
    });

    it('solo el ADMINISTRADOR gestiona usuarios', () => {
      const conGestion = (Object.keys(ROLES_PERMISOS) as Rol[]).filter((rol) =>
        ROLES_PERMISOS[rol].includes(PERMISOS.USUARIOS_GESTIONAR),
      );

      expect(conGestion).toEqual(['ADMINISTRADOR']);
    });

    it('solo el SUPER_ADMIN gestiona organizaciones SaaS', () => {
      const conGestionSaaS = (Object.keys(ROLES_PERMISOS) as Rol[]).filter((rol) =>
        ROLES_PERMISOS[rol].includes(PERMISOS.ORGANIZACIONES_GESTIONAR),
      );

      expect(conGestionSaaS).toEqual(['SUPER_ADMIN']);
    });

    it('los roles de inquilino (ADMIN, SUPERVISOR, TRABAJADOR) no tienen permisos SaaS', () => {
      expect(ROLES_PERMISOS.ADMINISTRADOR).not.toContain(PERMISOS.ORGANIZACIONES_GESTIONAR);
      expect(ROLES_PERMISOS.SUPERVISOR).not.toContain(PERMISOS.ORGANIZACIONES_GESTIONAR);
      expect(ROLES_PERMISOS.TRABAJADOR).not.toContain(PERMISOS.ORGANIZACIONES_GESTIONAR);
    });

    it('no hay permisos huerfanos: cada codigo lo usa al menos un rol', () => {
      const asignados = new Set<string>(Object.values(ROLES_PERMISOS).flat());
      const huerfanos = Object.values(PERMISOS).filter((p) => !asignados.has(p));

      expect(huerfanos).toEqual([]);
    });
  });

  describe('permisos del mapa y de eliminar tareas', () => {
    it('editar el mapa lo tienen por rol administrador y supervisor (como antes)', () => {
      expect(ROLES_PERMISOS.ADMINISTRADOR).toContain(PERMISOS.NODOS_EDITAR);
      expect(ROLES_PERMISOS.SUPERVISOR).toContain(PERMISOS.NODOS_EDITAR);
      expect(ROLES_PERMISOS.TRABAJADOR).not.toContain(PERMISOS.NODOS_EDITAR);
    });

    it('eliminar tareas lo tiene por rol solo el administrador (como antes)', () => {
      const conEliminar = (Object.keys(ROLES_PERMISOS) as Rol[]).filter((rol) =>
        ROLES_PERMISOS[rol].includes(PERMISOS.ACTIVIDADES_ELIMINAR),
      );
      expect(conEliminar).toEqual(['ADMINISTRADOR']);
    });
  });

  describe('permisosEfectivos', () => {
    it('un trabajador suma los permisos extra que le dieron', () => {
      const permisos = permisosEfectivos('TRABAJADOR', [PERMISOS.NODOS_EDITAR]);

      expect(permisos).toEqual([...ROLES_PERMISOS.TRABAJADOR, PERMISOS.NODOS_EDITAR]);
    });

    it('ignora codigos que no estan en el catalogo de permisos extra', () => {
      const permisos = permisosEfectivos('TRABAJADOR', [
        PERMISOS.USUARIOS_GESTIONAR,
        'inventado:permiso',
      ]);

      expect(permisos).toEqual([...ROLES_PERMISOS.TRABAJADOR]);
    });

    it('los extra no rigen si la persona ya no es trabajador', () => {
      expect(permisosEfectivos('SUPERVISOR', [PERMISOS.ACTIVIDADES_ELIMINAR])).toEqual([
        ...ROLES_PERMISOS.SUPERVISOR,
      ]);
    });

    it('sin extras devuelve exactamente los del rol', () => {
      expect(permisosEfectivos('TRABAJADOR', [])).toEqual([...ROLES_PERMISOS.TRABAJADOR]);
      expect(permisosEfectivos('TRABAJADOR', null)).toEqual([...ROLES_PERMISOS.TRABAJADOR]);
    });

    it('no altera la matriz de roles', () => {
      permisosEfectivos('TRABAJADOR', [PERMISOS.NODOS_EDITAR]);
      expect(ROLES_PERMISOS.TRABAJADOR).not.toContain(PERMISOS.NODOS_EDITAR);
    });

    it('el catalogo de extras solo trae permisos que existen', () => {
      const existentes = new Set<string>(Object.values(PERMISOS));
      expect(PERMISOS_EXTRA.every((p) => existentes.has(p.codigo))).toBe(true);
    });
  });

  describe('ROLES_CATALOGO', () => {
    it('cubre exactamente los roles de la matriz', () => {
      expect(ROLES_CATALOGO.map((r) => r.codigo).sort()).toEqual(
        (Object.keys(ROLES_PERMISOS) as Rol[]).sort(),
      );
    });

    it('cada entrada apunta a los permisos reales de su rol', () => {
      for (const detalle of ROLES_CATALOGO) {
        expect(detalle.permisos).toBe(ROLES_PERMISOS[detalle.codigo]);
      }
    });
  });
});
