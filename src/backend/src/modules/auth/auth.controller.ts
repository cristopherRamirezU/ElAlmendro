import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ActualizarPreferenciasDto } from './dto/actualizar-preferencias.dto';
import { CambiarContrasenaDto } from './dto/cambiar-contrasena.dto';
import { ActualizarZonaHorariaDto } from './dto/actualizar-zona-horaria.dto';
import { AceptarPoliticasDto } from './dto/aceptar-politicas.dto';
import { ErroresFotoFilter, FotoPerfilService, OPCIONES_SUBIDA_FOTO } from './foto-perfil.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Usuario, UsuarioActual } from '../../common/usuario-actual.decorator';
import { borrarCookieSesion, COOKIE_LEGADO, emitirCookieSesion } from '../../common/seguridad/sesion';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly fotos: FotoPerfilService,
  ) {}

  /** US-01 — inicia sesion y deja el token en una cookie httpOnly. */
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, usuario } = await this.auth.login(dto, req.ip);
    res.clearCookie(COOKIE_LEGADO, { path: '/' });
    emitirCookieSesion(res, token);
    return usuario;
  }

  /** Cierra la sesion de este navegador. */
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    borrarCookieSesion(res);
    return { ok: true };
  }

  /** Cierra la sesion en todos los dispositivos, incluido este. */
  @UseGuards(JwtAuthGuard)
  @Post('cerrar-todas')
  @HttpCode(200)
  async cerrarTodas(
    @Usuario() usuario: UsuarioActual,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.cerrarTodas(usuario, req.ip);
    borrarCookieSesion(res);
    return { ok: true };
  }

  /** Devuelve el usuario de la sesion vigente. */
  @UseGuards(JwtAuthGuard)
  @Get('yo')
  yo(@Usuario() usuario: UsuarioActual) {
    return usuario;
  }

  /** Preferencias del propio usuario (por ahora, el fondo del mapa de nodos). */
  @UseGuards(JwtAuthGuard)
  @Patch('yo/preferencias')
  actualizarPreferencias(@Usuario() usuario: UsuarioActual, @Body() dto: ActualizarPreferenciasDto) {
    return this.auth.actualizarPreferencias(usuario.id, dto);
  }

  /** Zona horaria propia: con ella se cuentan sus dias y se muestran sus horas. */
  @UseGuards(JwtAuthGuard)
  @Patch('yo/zona-horaria')
  actualizarZonaHoraria(@Usuario() usuario: UsuarioActual, @Body() dto: ActualizarZonaHorariaDto) {
    return this.auth.actualizarZonaHoraria(usuario.id, dto.zonaHoraria);
  }

  /** Sube (o reemplaza) la propia foto de perfil: JPG, PNG o WebP de hasta 2 MB. */
  @UseGuards(JwtAuthGuard)
  @Post('yo/foto')
  @HttpCode(200)
  @UseFilters(ErroresFotoFilter)
  @UseInterceptors(FileInterceptor('foto', OPCIONES_SUBIDA_FOTO))
  subirFoto(@Usuario() usuario: UsuarioActual, @UploadedFile() archivo: Express.Multer.File) {
    return this.fotos.subir(usuario, archivo);
  }

  /** Quita la foto: vuelven las iniciales. */
  @UseGuards(JwtAuthGuard)
  @Delete('yo/foto')
  quitarFoto(@Usuario() usuario: UsuarioActual) {
    return this.fotos.quitar(usuario);
  }

  /** Acepta la version vigente de los terminos de uso y la politica de privacidad. */
  @UseGuards(JwtAuthGuard)
  @Post('yo/politicas')
  @HttpCode(200)
  aceptarPoliticas(@Usuario() usuario: UsuarioActual, @Body() dto: AceptarPoliticasDto, @Req() req: Request) {
    return this.auth.aceptarPoliticas(usuario, dto.version, req.ip);
  }

  /** Rechaza los terminos: queda registrado y se cierra la sesion de este navegador. */
  @UseGuards(JwtAuthGuard)
  @Post('yo/politicas/rechazo')
  @HttpCode(200)
  async rechazarPoliticas(
    @Usuario() usuario: UsuarioActual,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.rechazarPoliticas(usuario, req.ip);
    borrarCookieSesion(res);
    return { ok: true };
  }

  /**
   * Cambia la propia contrasena. Los demas dispositivos quedan fuera; este
   * sigue dentro con un token nuevo.
   */
  @UseGuards(JwtAuthGuard)
  @Patch('yo/contrasena')
  async cambiarContrasena(
    @Usuario() usuario: UsuarioActual,
    @Body() dto: CambiarContrasenaDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.auth.cambiarContrasena(usuario, dto, req.ip);
    emitirCookieSesion(res, token);
    return { ok: true };
  }
}
