import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './infra/prisma/prisma.module';
import { ApiRaizController, SaludController } from './common/salud.controller';
import { AuthModule } from './modules/auth/auth.module';
import { JornadaModule } from './modules/jornada/jornada.module';
import { ActividadesModule } from './modules/actividades/actividades.module';
import { SesionesModule } from './modules/sesiones/sesiones.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { NodosModule } from './modules/nodos/nodos.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CalendarioModule } from './modules/calendario/calendario.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { ProyectosModule } from './modules/proyectos/proyectos.module';
import { EvidenciasModule } from './modules/evidencias/evidencias.module';
import { ChatModule } from './modules/chat/chat.module';
import { OrganizacionesModule } from './modules/organizaciones/organizaciones.module';

/**
 * Raiz de la capa de negocio.
 *
 * Cada modulo de la seccion 4.3 del documento de arquitectura se agrega aqui a
 * medida que se implementa. Norma del equipo: ningun modulo importa el
 * repositorio de otro; se habla por servicios publicos o por eventos.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    JornadaModule,
    ActividadesModule,
    SesionesModule,
    ReportesModule,
    NodosModule,
    DashboardModule,
    CalendarioModule,
    UsuariosModule,
    ProyectosModule,
    EvidenciasModule,
    ChatModule,
    OrganizacionesModule,
    // HistorialModule, NotificacionesModule,
  ],
  controllers: [SaludController, ApiRaizController],
})
export class AppModule {}
