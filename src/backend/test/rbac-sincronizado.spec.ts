import * as backend from '../src/common/rbac';
import * as frontend from '../../frontend/src/lib/rbac';

/**
 * La matriz de permisos esta escrita dos veces: la del backend es la que manda
 * (el guard la aplica en cada peticion) y la del frontend decide que se le
 * muestra al usuario.
 *
 * Si se separan, la interfaz ofrece botones que el servidor responde con 403,
 * o esconde opciones a las que el usuario si tiene derecho. Este test es el
 * que impide que eso pase inadvertido.
 *
 * Al agregar un permiso o un rol hay que tocar LOS DOS archivos.
 */
describe('RBAC sincronizado entre backend y frontend', () => {
  it('el catalogo de permisos es identico', () => {
    expect(frontend.PERMISOS).toEqual(backend.PERMISOS);
  });

  it('la matriz de roles y permisos es identica', () => {
    expect(frontend.ROLES_PERMISOS).toEqual(backend.ROLES_PERMISOS);
  });

  it('ambos lados definen exactamente los mismos roles', () => {
    expect(Object.keys(frontend.ROLES_PERMISOS).sort()).toEqual(
      Object.keys(backend.ROLES_PERMISOS).sort(),
    );
  });

  it('el catalogo de roles describe los mismos codigos', () => {
    expect(frontend.ROLES_CATALOGO.map((r) => r.codigo).sort()).toEqual(
      backend.ROLES_CATALOGO.map((r) => r.codigo).sort(),
    );
  });
});
