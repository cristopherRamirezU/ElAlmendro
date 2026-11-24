import { ErrorApi, traducirErrorHttp, urlFotoPerfil } from '@/lib/api';

describe('Cliente API y traduccion de errores HTTP', () => {
  it('ErrorApi marca como recuperables los errores de red y transitorios', () => {
    expect(new ErrorApi(0, 'red').recuperable).toBe(true);
    expect(new ErrorApi(408, 'timeout').recuperable).toBe(true);
    expect(new ErrorApi(429, 'rate').recuperable).toBe(true);
    expect(new ErrorApi(503, 'down').recuperable).toBe(true);

    expect(new ErrorApi(400, 'bad').recuperable).toBe(false);
    expect(new ErrorApi(403, 'forbidden').recuperable).toBe(false);
    expect(new ErrorApi(404, 'not found').recuperable).toBe(false);
    expect(new ErrorApi(400, 'override', { recuperable: true }).recuperable).toBe(true);
  });

  it('traducirErrorHttp produce mensajes claros por estado y contexto de ruta', () => {
    expect(traducirErrorHttp(0)).toContain('Sin conexión con el servidor');
    expect(traducirErrorHttp(401, 'Unauthorized')).toContain('sesión expiró');
    expect(traducirErrorHttp(401, 'Credenciales inválidas')).toBe('Credenciales inválidas');

    expect(traducirErrorHttp(403, 'Forbidden', '/actividades/posiciones')).toContain('Editar el mapa');
    expect(traducirErrorHttp(403, 'Forbidden', '/usuarios/123')).toContain('gestionar usuarios');
    expect(traducirErrorHttp(403, 'Forbidden', '/organizaciones/mia/color')).toContain('Administrador');
    expect(traducirErrorHttp(403, 'Forbidden', '/organizaciones')).toContain('Super Administrador');
    expect(traducirErrorHttp(403, 'Forbidden', '/proyectos')).toContain('proyecto o tarea');
    expect(traducirErrorHttp(403, 'Forbidden', '/otro')).toContain('permisos necesarios');
    expect(traducirErrorHttp(403, 'Motivo propio del backend', '/usuarios')).toBe('Motivo propio del backend');

    expect(traducirErrorHttp(404, 'Not Found')).toContain('no existe o fue eliminado');
    expect(traducirErrorHttp(429)).toContain('Demasiadas solicitudes');
    expect(traducirErrorHttp(502, 'Internal Server Error')).toContain('inconveniente temporal');
    expect(traducirErrorHttp(400, 'Bad Request')).toContain('Revisa los datos');
  });

  it('urlFotoPerfil codifica la version para invalidar cache de forma segura', () => {
    expect(urlFotoPerfil('usr-1', 'v 1&a=b')).toContain('/api/fotos-perfil/usr-1?v=v%201%26a%3Db');
  });
});
