import { Module } from '@nestjs/common';
import { ActividadesController } from './actividades.controller';
import { ActividadesService } from './actividades.service';
import { AudioComentarioController } from './audio-comentario.controller';
import { AudioComentarioService } from './audio-comentario.service';
import { AlmacenamientoModule } from '../../infra/almacenamiento/almacenamiento.module';

@Module({
  imports: [AlmacenamientoModule],
  controllers: [ActividadesController, AudioComentarioController],
  providers: [ActividadesService, AudioComentarioService],
  exports: [ActividadesService],
})
export class ActividadesModule {}
