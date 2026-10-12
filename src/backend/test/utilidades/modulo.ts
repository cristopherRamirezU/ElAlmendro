import { Test } from '@nestjs/testing';
import { Provider, Type } from '@nestjs/common';
import { PrismaService } from '../../src/infra/prisma/prisma.service';
import { LimiteIntentosService } from '../../src/common/seguridad/limite-intentos.service';
import { crearPrismaMock, PrismaMock } from './prisma-mock';

/**
 * Monta un servicio aislado con Prisma simulado.
 * Un solo llamado por describe().
 */
export async function montarServicio<T>(
  Clase: Type<T>,
  extras: Provider[] = [],
): Promise<{ servicio: T; prisma: PrismaMock }> {
  const prisma = crearPrismaMock();

  const modulo = await Test.createTestingModule({
    providers: [
      Clase,
      { provide: PrismaService, useValue: prisma },
      LimiteIntentosService,
      ...extras,
    ],
  }).compile();

  return { servicio: modulo.get(Clase), prisma };
}
