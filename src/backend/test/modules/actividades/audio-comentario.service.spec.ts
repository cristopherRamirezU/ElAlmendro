import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  AudioComentarioService,
  puedeEliminarAudio,
  puedeGrabarAudio,
} from '../../../src/modules/actividades/audio-comentario.service';
import { AlmacenamientoService } from '../../../src/infra/almacenamiento/almacenamiento.service';
import { LimiteIntentosService } from '../../../src/common/seguridad/limite-intentos.service';
import { montarServicio } from '../../utilidades/modulo';
import { PrismaMock } from '../../utilidades/prisma-mock';
import { UsuarioActual } from '../../../src/common/usuario-actual.decorator';

const RESPONSABLE: UsuarioActual = {
  id: 'u-1',
  email: 'camila@org1.cl',
  nombreCompleto: 'Camila',
  rol: 'TRABAJADOR',
  permisos: [],
  organizacionId: 'org-1',
  zonaHoraria: 'America/Santiago',
};

const OTRO: UsuarioActual = { ...RESPONSABLE, id: 'u-2', email: 'diego@org1.cl' };
const ADMIN: UsuarioActual = { ...RESPONSABLE, id: 'admin-1', rol: 'ADMINISTRADOR' };

const TAREA = {
  titulo: 'Implementar nodos',
  proyectoId: 'proy-1',
  creadoPorId: 'admin-1',
  responsableId: 'u-1',
  proyecto: { organizacionId: 'org-1' },
};

describe('AudioComentarioService', () => {
  let servicio: AudioComentarioService;
  let prisma: PrismaMock;
  const almacenamiento = { subir: jest.fn(), descargar: jest.fn(), eliminar: jest.fn() };
  const limites = { consumir: jest.fn() };

  beforeEach(async () => {
    almacenamiento.subir.mockReset();
    almacenamiento.eliminar.mockReset();
    limites.consumir.mockReset();
    ({ servicio, prisma } = await montarServicio(AudioComentarioService, [
      { provide: AlmacenamientoService, useValue: almacenamiento },
      { provide: LimiteIntentosService, useValue: limites },
    ]));
  });

  it('evalua correctamente quien puede grabar y borrar audios', () => {
    expect(puedeGrabarAudio(RESPONSABLE, TAREA)).toBe(true);
    expect(puedeGrabarAudio(ADMIN, TAREA)).toBe(true);
    expect(puedeGrabarAudio(OTRO, TAREA)).toBe(false);

    expect(puedeEliminarAudio(RESPONSABLE, 'u-1')).toBe(true);
    expect(puedeEliminarAudio(OTRO, 'u-1')).toBe(false);
    expect(puedeEliminarAudio(ADMIN, 'u-1')).toBe(true);
  });

  it('rechaza grabaciones de usuarios ajenos a la tarea y firmas binarias invalidas', async () => {
    prisma.actividad.findFirst.mockResolvedValue(TAREA as never);

    await expect(
      servicio.subir('act-1', OTRO, { buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]) } as never),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      servicio.subir('act-1', RESPONSABLE, { buffer: Buffer.from('texto plano no audio') } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('sube WebM valido y limpia S3 si falla la transaccion en Prisma', async () => {
    prisma.actividad.findFirst.mockResolvedValue(TAREA as never);
    almacenamiento.subir.mockResolvedValue(undefined);
    almacenamiento.eliminar.mockResolvedValue(undefined);
    prisma.$transaction.mockRejectedValueOnce(new Error('Fallo BD'));

    const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f]);

    await expect(
      servicio.subir('act-1', RESPONSABLE, { buffer: webm } as never, '15'),
    ).rejects.toThrow('Fallo BD');

    expect(limites.consumir).toHaveBeenCalled();
    expect(almacenamiento.eliminar).toHaveBeenCalledWith(
      expect.stringMatching(/^audios-comentario\/act-1\//),
    );
  });
});
