import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RegistroService } from './registro.service';
import { RegistroDto } from './dto/registro.dto';

/** Ruta publica (sin sesion): la usa la pagina "Crear cuenta" de la web. */
@ApiTags('registro')
@Controller('registro')
export class RegistroController {
  constructor(private readonly registro: RegistroService) {}

  @Post()
  @HttpCode(201)
  registrar(@Body() dto: RegistroDto, @Req() req: Request) {
    return this.registro.registrar(dto, req.ip);
  }
}
