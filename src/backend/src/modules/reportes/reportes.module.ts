import { Module } from '@nestjs/common';
import { ExportacionModule } from '../../common/exportacion/exportacion.module';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

@Module({
  imports: [ExportacionModule],
  controllers: [ReportesController],
  providers: [ReportesService],
  exports: [ReportesService],
})
export class ReportesModule {}
