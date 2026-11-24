import { BadRequestException } from '@nestjs/common';
import { JornadaService } from '../../../src/modules/jornada/jornada.service';
import { montarServicio } from '../../utilidades/modulo';
import { PrismaMock } from '../../utilidades/prisma-mock';

describe('JornadaService', () => {
  let servicio: JornadaService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    ({ servicio, prisma } = await montarServicio(JornadaService));
  });

  it('abre jornada y registra auditoria cuando no hay una abierta', async () => {
    prisma.jornada.findFirst.mockResolvedValue(null);
    prisma.jornada.create.mockResolvedValue({
      id: 'j-1',
      usuarioId: 'u-1',
      organizacionId: 'org-1',
      estado: 'ABIERTA',
    } as never);
    prisma.registroAuditoria.create.mockResolvedValue({} as never);

    const res = await servicio.entrada('u-1', 'org-1');

    expect(res.id).toBe('j-1');
    expect(prisma.jornada.create).toHaveBeenCalledWith({
      data: { usuarioId: 'u-1', organizacionId: 'org-1', estado: 'ABIERTA' },
    });
    expect(prisma.registroAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'u-1',
        organizacionId: 'org-1',
        accion: 'JORNADA_ABIERTA',
      }),
    });
  });

  it('impide abrir dos jornadas simultaneas', async () => {
    prisma.jornada.findFirst.mockResolvedValue({ id: 'j-abierta' } as never);

    await expect(servicio.entrada('u-1', 'org-1')).rejects.toThrow(BadRequestException);
    expect(prisma.jornada.create).not.toHaveBeenCalled();
  });

  it('bloquea la salida si existe una sesion de cronometro viva', async () => {
    prisma.jornada.findFirst.mockResolvedValue({ id: 'j-1' } as never);
    prisma.sesionTrabajo.findFirst.mockResolvedValue({ id: 's-viva', estado: 'ACTIVA' } as never);

    await expect(servicio.salida('u-1')).rejects.toThrow(BadRequestException);
    expect(prisma.jornada.update).not.toHaveBeenCalled();
  });

  it('cierra la jornada abierta y registra auditoria cuando no hay sesiones activas', async () => {
    prisma.jornada.findFirst.mockResolvedValue({ id: 'j-1' } as never);
    prisma.sesionTrabajo.findFirst.mockResolvedValue(null);
    prisma.jornada.update.mockResolvedValue({
      id: 'j-1',
      organizacionId: 'org-1',
      estado: 'CERRADA',
    } as never);
    prisma.registroAuditoria.create.mockResolvedValue({} as never);

    const res = await servicio.salida('u-1');

    expect(res.estado).toBe('CERRADA');
    expect(prisma.registroAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accion: 'JORNADA_CERRADA',
        organizacionId: 'org-1',
      }),
    });
  });
});
