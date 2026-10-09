import { Body, Controller, Get, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService, duracionSesion } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ActualizarPreferenciasDto } from './dto/actualizar-preferencias.dto';
import { COOKIE_ACCESO, JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Usuario, UsuarioActual } from '../../common/usuario-actual.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** US-01 — inicia sesion y deja el token en una cookie httpOnly. */
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, usuario } = await this.auth.login(dto);

    // La cookie debe vivir al menos tanto como el token; con sesion
    // indefinida se deja un ano, que en la practica es "hasta cerrar sesion".
    res.cookie(COOKIE_ACCESO, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: duracionSesion() ? milisegundos(duracionSesion()!) : 365 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return usuario;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_ACCESO, { path: '/' });
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
}

/** "15m" -> 900000, "8h" -> 28800000, "7d" -> ...; si no se entiende, 8 horas. */
function milisegundos(ttl: string): number {
  const m = /^(\d+)\s*([smhd])?$/i.exec(ttl);
  if (!m) return 8 * 60 * 60 * 1000;
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[(m[2] ?? 's').toLowerCase()] ?? 1000;
  return Number(m[1]) * factor;
}
