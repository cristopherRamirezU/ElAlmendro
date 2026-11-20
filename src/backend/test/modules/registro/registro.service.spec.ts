import { BadRequestException, HttpException } from '@nestjs/common';
import { RegistroService, slugDesde } from '../../../src/modules/registro/registro.service';
import { LimiteIntentosService } from '../../../src/common/seguridad/limite-intentos.service';

function armar() {
  const prisma = {
    organizacion: { findUnique: jest.fn().mockResolvedValue(null) },
    registroAuditoria: { create: jest.fn().mockResolvedValue({}) },
  };
  const organizaciones = {
    crear: jest.fn().mockResolvedValue({ id: 'org-1', nombre: 'Panadería Ñuñoa', plan: 'GRATIS' }),
  };
  const limites = new LimiteIntentosService();
  const servicio = new RegistroService(prisma as never, organizaciones as never, limites);
  return { prisma, organizaciones, limites, servicio };
}

const VALIDO = {
  empresa: 'Panadería Ñuñoa',
  nombre: 'Ana Pérez',
  correo: '  Ana@Correo.CL ',
  contrasena: 'Pan4deria-Sur7',
  aceptaTerminos: true,
};

describe('RegistroService', () => {
  it('crea la empresa con el plan Basico y deja al usuario como administrador', async () => {
    const { servicio, organizaciones, prisma } = armar();

    const r = await servicio.registrar({ ...VALIDO }, '1.2.3.4');

    expect(organizaciones.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Panadería Ñuñoa',
        slug: 'panaderia-nunoa',
        plan: 'GRATIS',
        maxUsuarios: 10,
        maxProyectos: 5,
        adminEmail: 'ana@correo.cl',
        adminNombre: 'Ana Pérez',
      }),
    );
    expect(prisma.registroAuditoria.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accion: 'REGISTRO_PUBLICO', direccionIp: '1.2.3.4' }),
      }),
    );
    expect(r).toEqual({ empresa: 'Panadería Ñuñoa', correo: 'ana@correo.cl', plan: 'GRATIS' });
  });

  it('si el nombre ya esta tomado, agrega un sufijo al identificador', async () => {
    const { servicio, organizaciones, prisma } = armar();
    prisma.organizacion.findUnique.mockResolvedValueOnce({ id: 'otra' });

    await servicio.registrar({ ...VALIDO }, '1.2.3.4');

    const { slug } = organizaciones.crear.mock.calls[0][0];
    expect(slug).toMatch(/^panaderia-nunoa-[0-9a-f]{6}$/);
  });

  it('rechaza cuando el campo trampa viene lleno, sin crear nada', async () => {
    const { servicio, organizaciones } = armar();

    await expect(servicio.registrar({ ...VALIDO, sitioWeb: 'http://spam' }, '1.2.3.4')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(organizaciones.crear).not.toHaveBeenCalled();
  });

  it('rechaza una contrasena que no cumple la politica', async () => {
    const { servicio, organizaciones } = armar();

    await expect(servicio.registrar({ ...VALIDO, contrasena: 'solo-letras' }, '1.2.3.4')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(organizaciones.crear).not.toHaveBeenCalled();
  });

  it('frena muchas altas desde la misma IP', async () => {
    const { servicio } = armar();
    for (let i = 0; i < 5; i++) await servicio.registrar({ ...VALIDO }, '9.9.9.9');

    await expect(servicio.registrar({ ...VALIDO }, '9.9.9.9')).rejects.toBeInstanceOf(HttpException);
    // Otra IP no queda afectada.
    await expect(servicio.registrar({ ...VALIDO }, '8.8.8.8')).resolves.toBeDefined();
  });
});

describe('slugDesde', () => {
  it('quita tildes, simbolos y espacios', () => {
    expect(slugDesde('  Café & Té  Ltda. ')).toBe('cafe-te-ltda');
  });

  it('nunca queda vacio', () => {
    expect(slugDesde('¡¡¡')).toBe('empresa');
  });
});
