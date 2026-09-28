import {
  PERMISOS,
  ROLES_PERMISOS,
  ROLES_CATALOGO,
  obtenerPermisosDeRol,
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
