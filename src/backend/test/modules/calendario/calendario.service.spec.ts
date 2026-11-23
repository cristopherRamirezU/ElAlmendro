import { BadRequestException } from '@nestjs/common';
import { CalendarioService } from '../../../src/modules/calendario/calendario.service';
import { montarServicio } from '../../utilidades/modulo';
import { PrismaMock } from '../../utilidades/prisma-mock';

const ORG = 'org-1';

describe('CalendarioService', () => {
  let servicio: CalendarioService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    ({ servicio, prisma } = await montarServicio(CalendarioService));
  });

  it('incluye trabajadores, supervisores y administradores en la nomina', async () => {
    prisma.usuario.findMany.mockResolvedValue([] as never);
    (prisma.$queryRaw as unknown as jest.Mock).mockResolvedValue([]);

    await servicio.resumen(ORG, '2026-10-01', '2026-10-07');

    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizacionId: ORG,
          rol: { in: ['TRABAJADOR', 'SUPERVISOR', 'ADMINISTRADOR'] },
          activo: true,
        }),
      }),
    );
  });

  it('marca alerta de horasExcesivas cuando un dia supera las 12 horas imputadas', async () => {
    prisma.usuario.findMany.mockResolvedValue([
      { id: 'u1', nombreCompleto: 'Ana', zonaHoraria: 'America/Santiago' },
    ] as never);
    (prisma.$queryRaw as unknown as jest.Mock).mockResolvedValue([
      {
        fecha: '2026-10-14',
        trabajadorId: 'u1',
        trabajador: 'Ana',
        segundosImputados: 15 * 3600,
        segundosPresencia: 15 * 3600,
        sesiones: 1,
        jornadasAbiertas: 0,
        autocerradas: 0,
        inconclusas: 0,
      },
    ]);

    const res = await servicio.resumen(ORG, '2026-10-14', '2026-10-14');

    expect(res.celdas[0].horasExcesivas).toBe(true);
    expect(res.dias[0].alertas.horasExcesivas).toBe(1);
    expect(res.dias[0].alertas.total).toBe(1);
  });

  it('rechaza rangos invertidos o mayores a 366 dias', async () => {
    await expect(servicio.resumen(ORG, '2026-10-10', '2026-10-01')).rejects.toThrow(
      BadRequestException,
    );
    await expect(servicio.resumen(ORG, '2025-01-01', '2026-12-31')).rejects.toThrow(
      BadRequestException,
    );
  });
});
