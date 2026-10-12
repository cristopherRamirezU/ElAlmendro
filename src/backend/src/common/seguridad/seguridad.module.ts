import { Global, Module } from '@nestjs/common';
import { LimiteIntentosService } from './limite-intentos.service';

/** Piezas de seguridad compartidas por todos los modulos. */
@Global()
@Module({
  providers: [LimiteIntentosService],
  exports: [LimiteIntentosService],
})
export class SeguridadModule {}
