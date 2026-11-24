import { ForbiddenException } from '@nestjs/common';
import { HistorialService } from '../../../src/modules/historial/historial.service';
import { montarServicio } from '../../utilidades/modulo';
import { PrismaMock } from '../../utilidades/prisma-mock';
import { UsuarioActual } from '../../../src/common/usuario-actual.decorator';

const ADMIN: UsuarioActual = {
  id: 'admin-1',
  email: 'admin@org1.cl',
  nombreCompleto: 'Admin Org 1',
  rol: 'ADMINISTRADOR',
  permisos: [],
  organizacionId: 'org-1',
  zonaHoraria: 'America/Santiago',
};

const SUPER_ADMIN: UsuarioActual = {
  id: 'sa-1',
  email: 'sa@timeflow.cl',
  nombreCompleto: 'Super Admin',
  rol: 'SUPER_ADMIN',
  permisos: [],
  organizacionId: null,
  zonaHoraria: 'America/Santiago',
};

describe('HistorialService', () => {
  let servicio: HistorialService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    ({ servicio, prisma } = await montarServicio(HistorialService));
  });

  it('acota la consulta a la organizacion del administrador aunque pida otra', async () => {
    prisma.registroAuditoria.findMany.mockResolvedValue([] as never);
    prisma.registroAuditoria.count.mockResolvedValue(0);

    const res = await servicio.listar(ADMIN, {
      organizacionId: 'org-ajena',
      pagina: 2,
      limite: 10,
      tipoEntidad: 'Actividad',
    });

    expect(prisma.registroAuditoria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizacionId: 'org-1',
          tipoEntidad: 'Actividad',
        }),
        skip: 10,
        take: 10,
      }),
    );
    expect(res).toEqual({
      items: [],
      total: 0,
      pagina: 2,
      limite: 10,
      totalPaginas: 1,
    });
  });

  it('permite a SUPER_ADMIN consultar global o filtrar por organizacion', async () => {
    prisma.registroAuditoria.findMany.mockResolvedValue([{ id: 'r-1' }] as never);
    prisma.registroAuditoria.count.mockResolvedValue(31);

    const global = await servicio.listar(SUPER_ADMIN, { limite: 15 });
    expect(prisma.registroAuditoria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        skip: 0,
        take: 15,
      }),
    );
    expect(global.totalPaginas).toBe(3);

    await servicio.listar(SUPER_ADMIN, { organizacionId: 'org-2', busqueda: 'Ana' });
    expect(prisma.registroAuditoria.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizacionId: 'org-2',
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it('rechaza usuarios operacionales sin organizacionId', async () => {
    const huerfano = { ...ADMIN, organizacionId: null };
    await expect(servicio.listar(huerfano, {})).rejects.toThrow(ForbiddenException);
  });
});
