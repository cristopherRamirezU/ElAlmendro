import { Module } from '@nestjs/common';
import { OrganizacionesModule } from '../organizaciones/organizaciones.module';
import { RegistroController } from './registro.controller';
import { RegistroService } from './registro.service';

@Module({
  imports: [OrganizacionesModule],
  controllers: [RegistroController],
  providers: [RegistroService],
})
export class RegistroModule {}
