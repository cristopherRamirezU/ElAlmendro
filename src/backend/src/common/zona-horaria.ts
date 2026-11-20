import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../infra/prisma/prisma.service';

export const ZONA_POR_DEFECTO = 'America/Santiago';

/**
 * Comprueba que la zona horaria exista para PostgreSQL y la devuelve limpia.
 *
 * Se valida contra la base y no contra Node: la zona se usa en las consultas
 * (AT TIME ZONE "zonaHoraria"), y un nombre que el motor no reconozca haria
 * fallar el calendario, los reportes y el panel de esa persona.
 */
export async function exigirZonaHoraria(prisma: PrismaService, zona: string): Promise<string> {
  const limpia = zona.trim();
  if (!/^[A-Za-z0-9_+\-/]{1,64}$/.test(limpia)) {
    throw new BadRequestException('La zona horaria no es valida.');
  }
  const filas = await prisma.$queryRaw<{ existe: number }[]>`
    SELECT 1 AS existe FROM pg_timezone_names WHERE name = ${limpia} LIMIT 1
  `;
  if (filas.length === 0) {
    throw new BadRequestException(`La zona horaria "${limpia}" no es reconocida.`);
  }
  return limpia;
}
