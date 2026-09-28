import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../infra/prisma/prisma.service';

/** Verificacion de que la API y la base de datos responden. */
@ApiTags('salud')
@Controller('salud')
export class SaludController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async estado() {
    const [{ ahora }] = await this.prisma.$queryRaw<{ ahora: Date }[]>`SELECT now() AS ahora`;
    return {
      api: 'ok',
      baseDatos: 'ok',
      // Marca de servidor: unica fuente valida de tiempo del sistema (2.2).
      marcaServidor: ahora,
    };
  }
}

/** Raiz de la API para responder amigablemente en /api en lugar de 404 */
@Controller()
export class ApiRaizController {
  @Get()
  raiz() {
    return {
      sistema: 'TimeFlow API - Plataforma Multi-SaaS',
      version: '0.1.0',
      estado: 'operativo',
      documentacion: '/api/docs',
      salud: '/api/salud',
    };
  }
}
