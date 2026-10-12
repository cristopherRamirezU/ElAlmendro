import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/** Cuantos eventos se toleran en una ventana y cuanto dura el bloqueo al pasarse. */
export interface ReglaLimite {
  maximo: number;
  ventanaMs: number;
  bloqueoMs: number;
}

const MINUTO = 60_000;

/**
 * Reglas del sistema. Los numeros buscan que una persona que se equivoca
 * nunca choque con ellos y que un programa que prueba claves quede frenado.
 */
export const REGLAS = {
  /** Misma cuenta desde la misma IP: el caso de alguien probando claves. */
  loginCuentaIp: { maximo: 5, ventanaMs: 15 * MINUTO, bloqueoMs: 15 * MINUTO },
  /** Misma cuenta desde cualquier IP: frena un ataque repartido entre muchas IP. */
  loginCuenta: { maximo: 10, ventanaMs: 15 * MINUTO, bloqueoMs: 15 * MINUTO },
  /** Una IP probando muchas cuentas distintas. */
  loginIp: { maximo: 30, ventanaMs: 15 * MINUTO, bloqueoMs: 30 * MINUTO },
  /** Clave actual mal escrita al cambiar la propia contrasena. */
  cambioContrasena: { maximo: 5, ventanaMs: 15 * MINUTO, bloqueoMs: 15 * MINUTO },
  /** Archivos subidos por una persona: evita llenar el disco a proposito. */
  subidaArchivos: { maximo: 60, ventanaMs: 60 * MINUTO, bloqueoMs: 15 * MINUTO },
} satisfies Record<string, ReglaLimite>;

interface Registro {
  eventos: number[];
  bloqueadoHasta: number;
}

/** Sobre este numero de claves se purgan las vencidas (memoria acotada). */
const LIMITE_REGISTROS = 10_000;

/**
 * Contador en memoria de intentos por clave (cuenta, IP, usuario...).
 *
 * Vive en el proceso: la API corre como un solo proceso de pm2, asi que no
 * hace falta Redis. Si algun dia se escala a varios procesos, este contador
 * debe pasar a un almacen compartido o cada proceso contara por separado.
 */
@Injectable()
export class LimiteIntentosService {
  private readonly registros = new Map<string, Registro>();

  /** Lanza 429 si alguna de las claves esta bloqueada. No cuenta un intento. */
  verificar(claves: string[], ahora = Date.now()): void {
    let espera = 0;
    for (const clave of claves) {
      const r = this.registros.get(clave);
      if (r && r.bloqueadoHasta > ahora) espera = Math.max(espera, r.bloqueadoHasta - ahora);
    }
    if (espera > 0) throw demasiadosIntentos(espera);
  }

  /**
   * Anota un evento en cada clave segun su regla. Devuelve true si con este
   * evento alguna clave quedo bloqueada (para auditarlo una sola vez).
   */
  registrar(entradas: [clave: string, regla: ReglaLimite][], ahora = Date.now()): boolean {
    let bloqueo = false;
    for (const [clave, regla] of entradas) {
      const r = this.registros.get(clave) ?? { eventos: [], bloqueadoHasta: 0 };
      r.eventos = r.eventos.filter((t) => ahora - t < regla.ventanaMs);
      r.eventos.push(ahora);
      if (r.eventos.length >= regla.maximo && r.bloqueadoHasta <= ahora) {
        r.bloqueadoHasta = ahora + regla.bloqueoMs;
        r.eventos = [];
        bloqueo = true;
      }
      this.registros.set(clave, r);
    }
    if (this.registros.size > LIMITE_REGISTROS) this.purgar(ahora);
    return bloqueo;
  }

  /**
   * Verifica y cuenta en un solo paso: para acciones que se limitan siempre,
   * no solo cuando fallan (por ejemplo, subir archivos).
   */
  consumir(clave: string, regla: ReglaLimite, ahora = Date.now()): void {
    this.verificar([clave], ahora);
    this.registrar([[clave, regla]], ahora);
  }

  /** Tras un acierto se olvidan los fallos previos de esas claves. */
  limpiar(claves: string[]): void {
    for (const clave of claves) this.registros.delete(clave);
  }

  private purgar(ahora: number) {
    const ventanaMaxima = Math.max(...Object.values(REGLAS).map((r) => r.ventanaMs));
    for (const [clave, r] of this.registros) {
      const ultimo = r.eventos[r.eventos.length - 1] ?? 0;
      if (r.bloqueadoHasta <= ahora && ahora - ultimo > ventanaMaxima) this.registros.delete(clave);
    }
  }
}

function demasiadosIntentos(esperaMs: number) {
  const minutos = Math.max(1, Math.ceil(esperaMs / MINUTO));
  return new HttpException(
    `Demasiados intentos. Por seguridad espera ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} antes de volver a intentarlo.`,
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
