import { Module } from '@nestjs/common';
import { ExportacionService } from './exportacion.service';

/**
 * Serializacion de datos a archivo, reutilizable por cualquier modulo.
 * No es @Global(): la importacion explicita documenta quien exporta.
 */
@Module({
  providers: [ExportacionService],
  exports: [ExportacionService],
})
export class ExportacionModule {}
