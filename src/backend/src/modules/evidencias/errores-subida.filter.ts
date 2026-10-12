import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { TAMANO_MAXIMO_MB } from './limites-subida';

/** Mensajes en ingles con que multer/busboy rechazan un formulario (ver multer.constants de Nest). */
const ERRORES_MULTIPART = [
  'Too many parts',
  'Too many files',
  'Field name too long',
  'Field value too long',
  'Too many fields',
  'Unexpected field',
  'Unexpected file field',
  'Field name missing',
  'Field name nesting too deep',
  'Multipart:',
];

/**
 * Traduce los rechazos de multer (archivo muy grande, formulario mal armado)
 * a mensajes en espanol. Cualquier otro error pasa tal cual.
 */
@Catch(HttpException)
export class ErroresSubidaFilter implements ExceptionFilter {
  catch(error: HttpException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const estado = error.getStatus();
    const cuerpo = error.getResponse();
    const mensaje = typeof cuerpo === 'string' ? cuerpo : (cuerpo as { message?: unknown }).message;

    if (estado === HttpStatus.PAYLOAD_TOO_LARGE) {
      res.status(estado).json({
        statusCode: estado,
        message: `El archivo supera el limite de ${TAMANO_MAXIMO_MB} MB.`,
      });
      return;
    }
    if (typeof mensaje === 'string' && ERRORES_MULTIPART.some((m) => mensaje.startsWith(m))) {
      res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'El archivo enviado no es valido. Adjunta un solo archivo e intenta de nuevo.',
      });
      return;
    }
    res.status(estado).json(typeof cuerpo === 'string' ? { statusCode: estado, message: cuerpo } : cuerpo);
  }
}
