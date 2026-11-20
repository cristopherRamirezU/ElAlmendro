import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FotosPerfilController } from './fotos-perfil.controller';
import { FotoPerfilService } from './foto-perfil.service';
import { AlmacenamientoModule } from '../../infra/almacenamiento/almacenamiento.module';

@Module({
  // global: el guard de JWT se usa en todos los modulos protegidos.
  imports: [JwtModule.register({ global: true }), AlmacenamientoModule],
  controllers: [AuthController, FotosPerfilController],
  providers: [AuthService, FotoPerfilService],
  exports: [JwtModule],
})
export class AuthModule {}
