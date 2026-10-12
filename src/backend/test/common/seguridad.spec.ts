import { HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LimiteIntentosService } from '../../src/common/seguridad/limite-intentos.service';
import { problemaContrasena } from '../../src/common/seguridad/politica-contrasena';
import {
  duracionSesion,
  firmarSesion,
  leerCookie,
  leerSesion,
  milisegundos,
  renovarTrasMs,
} from '../../src/common/seguridad/sesion';
import {
  limpiarNombreArchivo,
  limpiarTipoMime,
} from '../../src/modules/evidencias/limites-subida';

const MIN = 60_000;
const REGLA = { maximo: 3, ventanaMs: 10 * MIN, bloqueoMs: 5 * MIN };

describe('LimiteIntentosService', () => {
  let limite: LimiteIntentosService;
  beforeEach(() => {
    limite = new LimiteIntentosService();
  });

  it('bloquea al llegar al maximo dentro de la ventana y avisa cuanto esperar', () => {
    const t0 = 1_000_000;
    expect(limite.registrar([['k', REGLA]], t0)).toBe(false);
    expect(limite.registrar([['k', REGLA]], t0 + 1)).toBe(false);
    expect(limite.registrar([['k', REGLA]], t0 + 2)).toBe(true);

    expect(() => limite.verificar(['k'], t0 + 3)).toThrow(/espera 5 minutos/);
    try {
      limite.verificar(['k'], t0 + 3);
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(429);
    }
  });

  it('el bloqueo vence solo', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) limite.registrar([['k', REGLA]], t0 + i);
    expect(() => limite.verificar(['k'], t0 + 5 * MIN + 10)).not.toThrow();
  });

  it('los eventos fuera de la ventana no suman', () => {
    limite.registrar([['k', REGLA]], 0);
    limite.registrar([['k', REGLA]], 1);
    expect(limite.registrar([['k', REGLA]], 11 * MIN)).toBe(false);
    expect(() => limite.verificar(['k'], 11 * MIN)).not.toThrow();
  });

  it('limpiar borra los fallos acumulados', () => {
    limite.registrar([['k', REGLA]], 0);
    limite.registrar([['k', REGLA]], 1);
    limite.limpiar(['k']);
    expect(limite.registrar([['k', REGLA]], 2)).toBe(false);
  });

  it('consumir cuenta cada uso y corta al pasarse', () => {
    for (let i = 0; i < 3; i++) limite.consumir('subida', REGLA, i);
    expect(() => limite.consumir('subida', REGLA, 10)).toThrow(HttpException);
  });

  it('las claves son independientes', () => {
    for (let i = 0; i < 3; i++) limite.registrar([['a', REGLA]], i);
    expect(() => limite.verificar(['b'], 5)).not.toThrow();
  });
});

describe('politica de contrasenas', () => {
  it.each([
    ['corta1', /al menos 8/],
    ['solo-letras', /letras y números/],
    ['1234567890', /letras y números/],
    ['Password1', /común/],
    ['Timeflow2026!', /común/],
    ['SuperAdmin2026!', /común/],
    [' Espacio-1 ', /espacios/],
    ['a1'.repeat(65), /128/],
  ])('rechaza %p', (clave, motivo) => {
    expect(problemaContrasena(clave)).toMatch(motivo);
  });

  it('rechaza claves que contienen el correo', () => {
    expect(problemaContrasena('rodrigo2026', 'rodrigo@timeflow.cl')).toMatch(/correo/);
  });

  it.each(['Otono-Rio-2026', 'cafe con leche 7', 'Ñandú-volador-3'])('acepta %p', (clave) => {
    expect(problemaContrasena(clave, 'ana@timeflow.cl')).toBeNull();
  });
});

describe('sesion', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  describe('duracionSesion', () => {
    it.each(['indefinido', 'never', '0', '0d', 'INDEFINIDO', '  ', 'abc'])(
      'ya no permite sesiones sin vencimiento: %p queda en 30 dias',
      (valor) => {
        process.env.JWT_ACCESO_TTL = valor;
        expect(duracionSesion()).toBe('30d');
      },
    );

    it('respeta una duracion real', () => {
      process.env.JWT_ACCESO_TTL = '8h';
      expect(duracionSesion()).toBe('8h');
    });

    it('cae en JWT_ACCESS_TTL si no esta la variable en espanol', () => {
      delete process.env.JWT_ACCESO_TTL;
      process.env.JWT_ACCESS_TTL = '15m';
      expect(duracionSesion()).toBe('15m');
    });

    it('renueva el token antes de que venza, aunque la duracion sea corta', () => {
      process.env.JWT_ACCESO_TTL = '15m';
      expect(renovarTrasMs()).toBe(7.5 * MIN);
      process.env.JWT_ACCESO_TTL = '30d';
      expect(renovarTrasMs()).toBe(60 * MIN);
    });

    it('convierte a milisegundos', () => {
      expect(milisegundos('15m')).toBe(15 * MIN);
      expect(milisegundos('7d')).toBe(7 * 86_400_000);
    });
  });

  describe('leerSesion', () => {
    const jwt = new JwtService();
    beforeEach(() => {
      process.env.JWT_ACCESS_SECRET = 'secreto-de-pruebas-con-largo-suficiente-123';
    });

    it('acepta un token propio y devuelve id y version', async () => {
      const token = await firmarSesion(jwt, { id: 'u1', versionSesion: 2 });
      await expect(leerSesion(jwt, token)).resolves.toEqual(
        expect.objectContaining({ sub: 'u1', ver: 2, exp: expect.any(Number) }),
      );
    });

    it('rechaza los tokens de antes (sin version)', async () => {
      const viejo = await jwt.signAsync({ sub: 'u1', rol: 'ADMINISTRADOR' }, { secret: process.env.JWT_ACCESS_SECRET });
      await expect(leerSesion(jwt, viejo)).resolves.toBeNull();
    });

    it('rechaza un token firmado con otro secreto', async () => {
      const ajeno = await jwt.signAsync({ sub: 'u1', ver: 0 }, { secret: 'otro-secreto' });
      await expect(leerSesion(jwt, ajeno)).resolves.toBeNull();
    });

    it('rechaza un token sin firma (alg none)', async () => {
      const cabecera = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const carga = Buffer.from(JSON.stringify({ sub: 'u1', ver: 0 })).toString('base64url');
      await expect(leerSesion(jwt, `${cabecera}.${carga}.`)).resolves.toBeNull();
    });

    it('rechaza un token vencido', async () => {
      const vencido = await jwt.signAsync(
        { sub: 'u1', ver: 0, exp: Math.floor(Date.now() / 1000) - 10 },
        { secret: process.env.JWT_ACCESS_SECRET },
      );
      await expect(leerSesion(jwt, vencido)).resolves.toBeNull();
    });
  });

  it('leerCookie tolera valores mal codificados', () => {
    expect(leerCookie('a=1; tf_sesion=abc', 'tf_sesion')).toBe('abc');
    expect(leerCookie('tf_sesion=%E0%A4%A', 'tf_sesion')).toBeNull();
    expect(leerCookie(undefined, 'tf_sesion')).toBeNull();
  });
});

describe('subida de archivos', () => {
  it.each([
    ['../../etc/passwd', 'passwd'],
    ['C:\\Users\\x\\informe final.pdf', 'informe final.pdf'],
    ['factura\u0000.pdf', 'factura.pdf'],
    ['"<script>".html', 'script.html'],
    ['...', 'archivo'],
    ['', 'archivo'],
    ['reunión año.docx', 'reunión año.docx'],
  ])('limpia el nombre %p', (entrada, esperado) => {
    expect(limpiarNombreArchivo(entrada)).toBe(esperado);
  });

  it('acorta nombres largos conservando la extension', () => {
    const nombre = limpiarNombreArchivo(`${'a'.repeat(300)}.pdf`);
    expect(nombre.length).toBeLessThanOrEqual(150);
    expect(nombre.endsWith('.pdf')).toBe(true);
  });

  it('normaliza el tipo MIME o usa uno neutro', () => {
    expect(limpiarTipoMime('application/PDF')).toBe('application/pdf');
    expect(limpiarTipoMime('text/html\r\nSet-Cookie: x')).toBe('application/octet-stream');
    expect(limpiarTipoMime(undefined)).toBe('application/octet-stream');
  });
});
