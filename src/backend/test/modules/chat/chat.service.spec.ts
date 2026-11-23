import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChatService } from '../../../src/modules/chat/chat.service';
import { ChatGateway } from '../../../src/modules/chat/chat.gateway';
import { montarServicio } from '../../utilidades/modulo';
import { PrismaMock } from '../../utilidades/prisma-mock';
import { UsuarioActual } from '../../../src/common/usuario-actual.decorator';

const YO: UsuarioActual = {
  id: 'u-1',
  email: 'camila@org1.cl',
  nombreCompleto: 'Camila',
  rol: 'TRABAJADOR',
  permisos: [],
  organizacionId: 'org-1',
  zonaHoraria: 'America/Santiago',
};

describe('ChatService', () => {
  let servicio: ChatService;
  let prisma: PrismaMock;
  const gateway = {
    estaEnLinea: jest.fn().mockReturnValue(true),
    emitirMensaje: jest.fn(),
    emitirLectura: jest.fn(),
  };

  beforeEach(async () => {
    gateway.emitirMensaje.mockReset();
    gateway.emitirLectura.mockReset();
    ({ servicio, prisma } = await montarServicio(ChatService, [
      { provide: ChatGateway, useValue: gateway },
    ]));
  });

  it('rechaza mensajes vacios o enviados a uno mismo', async () => {
    await expect(servicio.enviar(YO, { cuerpo: '   ' })).rejects.toThrow(BadRequestException);
    await expect(
      servicio.enviar(YO, { cuerpo: 'Hola', receptorId: 'u-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('impide enviar mensajes privados a usuarios fuera de la organizacion', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);

    await expect(
      servicio.enviar(YO, { cuerpo: 'Hola', receptorId: 'u-ajeno' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.mensajeChat.create).not.toHaveBeenCalled();
  });

  it('persiste y emite por Socket.IO dentro de la organizacion del emisor', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ id: 'u-2' } as never);
    const creado = {
      id: 'm-1',
      emisorId: 'u-1',
      receptorId: 'u-2',
      cuerpo: 'Avance listo',
      creadoEn: new Date(),
      leidoEn: null,
      emisor: { id: 'u-1', nombreCompleto: 'Camila', fotoPerfil: null },
    };
    prisma.mensajeChat.create.mockResolvedValue(creado as never);

    const res = await servicio.enviar(YO, { cuerpo: ' Avance listo ', receptorId: 'u-2' });

    expect(res).toEqual(creado);
    expect(gateway.emitirMensaje).toHaveBeenCalledWith(creado, 'org-1');
  });

  it('marca como leidos y emite evento solo cuando hubo cambios', async () => {
    prisma.mensajeChat.updateMany.mockResolvedValueOnce({ count: 2 } as never);
    await expect(servicio.marcarLeidos(YO, 'u-2')).resolves.toEqual({ marcados: 2 });
    expect(gateway.emitirLectura).toHaveBeenCalledWith('u-2', 'u-1');

    gateway.emitirLectura.mockReset();
    prisma.mensajeChat.updateMany.mockResolvedValueOnce({ count: 0 } as never);
    await expect(servicio.marcarLeidos(YO, 'u-2')).resolves.toEqual({ marcados: 0 });
    expect(gateway.emitirLectura).not.toHaveBeenCalled();
  });
});
