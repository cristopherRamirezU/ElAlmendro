import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { politicasPendientes, VERSION_POLITICAS } from '../../../src/common/politicas';
import { montarServicio } from '../../utilidades/modulo';
import { PrismaMock } from '../../utilidades/prisma-mock';
import type { UsuarioActual } from '../../../src/common/usuario-actual.decorator';

const ACTOR = {
  id: 'usuario-1',
  email: 'ana@timeflow.cl',
  rol: 'TRABAJADOR',
  organizacionId: 'org-1',
} as unknown as UsuarioActual;

describe('Aceptacion de terminos y politica de privacidad', () => {
  let servicio: AuthService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    jest.clearAllMocks();
    ({ servicio, prisma } = await montarServicio(AuthService, [
      { provide: JwtService, useValue: { signAsync: jest.fn() } },
    ]));
  });

  it('quien nunca acepto, o acepto una version anterior, las tiene pendientes', () => {
    expect(politicasPendientes(null)).toBe(true);
    expect(politicasPendientes('2000-01-01')).toBe(true);
    expect(politicasPendientes(VERSION_POLITICAS)).toBe(false);
  });

  it('aceptar guarda la version vigente y lo deja en la auditoria con la IP', async () => {
    const r = await servicio.aceptarPoliticas(ACTOR, VERSION_POLITICAS, '200.1.2.3');

    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 'usuario-1' },
      data: { politicasVersion: VERSION_POLITICAS, politicasAceptadasEn: expect.any(Date) },
    });
    expect(prisma.registroAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accion: 'POLITICAS_ACEPTADAS',
        direccionIp: '200.1.2.3',
        valorNuevo: { version: VERSION_POLITICAS },
      }),
    });
    expect(r.politicasPendientes).toBe(false);
  });

  it('no acepta una version distinta de la vigente (pantalla vieja)', async () => {
    await expect(servicio.aceptarPoliticas(ACTOR, '1999-01-01')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('rechazar no cambia la cuenta: solo deja constancia en la auditoria', async () => {
    await servicio.rechazarPoliticas(ACTOR, '200.1.2.3');

    expect(prisma.usuario.update).not.toHaveBeenCalled();
    expect(prisma.registroAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ accion: 'POLITICAS_RECHAZADAS', direccionIp: '200.1.2.3' }),
    });
  });
});
