import { Global, Module } from '@nestjs/common';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesGateway } from './notificaciones.gateway';
import { NotificacionesService } from './notificaciones.service';

@Global()
@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService, NotificacionesGateway],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
