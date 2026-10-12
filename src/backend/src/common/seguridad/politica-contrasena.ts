import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Politica de contrasenas. El frontend repite estas reglas en
 * lib/contrasena.ts para avisar mientras se escribe: si cambian aqui, cambian
 * alla.
 */
export const CONTRASENA_MINIMO = 8;
export const CONTRASENA_MAXIMO = 128;

/**
 * Claves que no se aceptan aunque cumplan el largo: las mas usadas del mundo
 * y las que estuvieron publicadas en este repositorio (datos de prueba).
 * Se comparan en minusculas.
 */
const PROHIBIDAS = new Set([
  '12345678', '123456789', '1234567890', '0123456789', '87654321', '11111111', '00000000',
  '12341234', '11223344', '123123123', 'password', 'password1', 'password123', 'passw0rd',
  'contrasena', 'contrasena1', 'contraseña', 'contraseña1', 'qwerty12', 'qwerty123', 'qwertyui',
  'asdf1234', 'abc12345', 'abcd1234', 'a1b2c3d4', 'admin123', 'admin1234', 'administrador1',
  'iloveyou1', 'welcome1', 'bienvenido1', 'chile123', 'santiago1', 'temporal1', 'cambiar1',
  'timeflow1', 'timeflow123', 'timeflow2026', 'timeflow2026!', 'superadmin2026!', 'clave123',
  'clave1234', 'clavesegura1', 'clave123!', 'cliente2026', 'cliente2026!',
]);

/**
 * Devuelve el problema de la contrasena, o null si cumple la politica.
 * `correo` evita claves que repiten el propio correo.
 */
export function problemaContrasena(clave: unknown, correo?: string | null): string | null {
  if (typeof clave !== 'string') return 'La contraseña debe ser texto.';
  if (clave.length < CONTRASENA_MINIMO) {
    return `La contraseña debe tener al menos ${CONTRASENA_MINIMO} caracteres.`;
  }
  if (clave.length > CONTRASENA_MAXIMO) {
    return `La contraseña no puede superar los ${CONTRASENA_MAXIMO} caracteres.`;
  }
  if (clave.trim() !== clave) return 'La contraseña no puede empezar ni terminar con espacios.';
  if (!/\p{L}/u.test(clave) || !/\d/.test(clave)) {
    return 'La contraseña debe combinar letras y números.';
  }
  const minuscula = clave.toLowerCase();
  if (PROHIBIDAS.has(minuscula)) {
    return 'Esa contraseña es demasiado común. Elige otra más difícil de adivinar.';
  }
  const usuarioCorreo = correo?.split('@')[0]?.toLowerCase();
  if (usuarioCorreo && usuarioCorreo.length >= 4 && minuscula.includes(usuarioCorreo)) {
    return 'La contraseña no puede contener tu correo.';
  }
  return null;
}

/**
 * Decorador de class-validator con la politica completa. El correo no se
 * conoce aqui: esa regla la aplica el servicio, que si lo tiene.
 */
export function EsContrasenaSegura(opciones?: ValidationOptions) {
  return (objeto: object, propiedad: string) =>
    registerDecorator({
      name: 'esContrasenaSegura',
      target: objeto.constructor,
      propertyName: propiedad,
      options: opciones,
      validator: {
        validate: (valor: unknown) => problemaContrasena(valor) === null,
        defaultMessage: (args) => problemaContrasena(args?.value) ?? 'La contraseña no es válida.',
      },
    });
}
