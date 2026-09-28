import { Module } from '@nestjs/common';
import { OrganizacionesController } from './organizaciones.controller';
import { OrganizacionesService } from './organizaciones.service';
import { PrismaModule } from '../../infra/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizacionesController],
  providers: [OrganizacionesService],
  exports: [OrganizacionesService],
})
export class OrganizacionesModule {}
