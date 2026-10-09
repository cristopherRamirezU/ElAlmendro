import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActividadesService } from '../../../src/modules/actividades/actividades.service';
import { montarServicio } from '../../utilidades/modulo';
import { PrismaMock } from '../../utilidades/prisma-mock';
import { UsuarioActual } from '../../../src/common/usuario-actual.decorator';

const USUARIO = 'usuario-1';

// Los metodos reciben el usuario completo: el filtro Multi-SaaS necesita su
// organizacion para acotar las consultas a la empresa correcta.
const ACTOR = {
  id: USUARIO,
  email: 'ana@timeflow.cl',
  nombreCompleto: 'Ana',
  rol: 'TRABAJADOR',
  permisos: [],
  organizacionId: 'org-1',
} as UsuarioActual;

describe('ActividadesService', () => {
  let servicio: ActividadesService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    ({ servicio, prisma } = await montarServicio(ActividadesService));
  });

  describe('mias', () => {
    it('cruza el tiempo acumulado con cada actividad', async () => {
      prisma.actividad.findMany.mockResolvedValue([
        { id: 'a1' },
        { id: 'a2' },
      ] as never);
      prisma.$queryRaw.mockResolvedValue([
        { actividadId: 'a1', segundos: 3600 },
      ] as never);

      const actividades = await servicio.mias(ACTOR);

      expect(actividades[0].segundosTrabajados).toBe(3600);
    });

    it('una actividad sin tramos reporta 0, no undefined', async () => {
      prisma.actividad.findMany.mockResolvedValue([
        { id: 'a1' },
        { id: 'sin-sesiones' },
      ] as never);
      prisma.$queryRaw.mockResolvedValue([
        { actividadId: 'a1', segundos: 3600 },
      ] as never);

      const actividades = await servicio.mias(ACTOR);

      expect(actividades[1].segundosTrabajados).toBe(0);
    });

    it('redondea los segundos que Postgres devuelve como decimal', async () => {
      prisma.actividad.findMany.mockResolvedValue([{ id: 'a1' }] as never);
      prisma.$queryRaw.mockResolvedValue([
        { actividadId: 'a1', segundos: '1800.6' },
      ] as never);

      expect((await servicio.mias(ACTOR))[0].segundosTrabajados).toBe(1801);
    });

    it('sin actividades no consulta la base por los tiempos', async () => {
      prisma.actividad.findMany.mockResolvedValue([] as never);

      const actividades = await servicio.mias(ACTOR);

      // Evita lanzar un ANY('{}'::uuid[]) inutil contra Postgres.
      expect(actividades).toEqual([]);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('detalle', () => {
    it('rechaza una actividad inexistente o eliminada', async () => {
      prisma.actividad.findFirst.mockResolvedValue(null as never);

      await expect(servicio.detalle('fantasma', ACTOR)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('actualizarPadre', () => {
    const ACTIVIDAD = { id: 'A', proyectoId: 'p1' };

    beforeEach(() => {
      // 1er findFirst: la actividad. 2do: el padre propuesto.
      prisma.actividad.findFirst
        .mockResolvedValueOnce(ACTIVIDAD as never)
        .mockResolvedValueOnce({ id: 'padre' } as never);
    });

    it('rechaza que una tarea sea padre de si misma', async () => {
      await expect(
        servicio.actualizarPadre('A', ACTOR, { actividadPadreId: 'A' }),
      ).rejects.toThrow(/padre de si misma/i);
    });

    it('rechaza un padre de otro proyecto', async () => {
      prisma.actividad.findFirst.mockReset();
      prisma.actividad.findFirst
        .mockResolvedValueOnce(ACTIVIDAD as never)
        .mockResolvedValueOnce(null as never); // el padre no esta en el proyecto

      await expect(
        servicio.actualizarPadre('A', ACTOR, { actividadPadreId: 'ajena' }),
      ).rejects.toThrow(/no pertenece a este proyecto/i);
    });

    it('rechaza un ciclo indirecto: A -> B -> C, colgar A de C', async () => {
      // Caminando hacia arriba desde C: C -> B -> A, y A es la propia tarea.
      prisma.actividad.findUnique
        .mockResolvedValueOnce({ actividadPadreId: 'B' } as never)
        .mockResolvedValueOnce({ actividadPadreId: 'A' } as never);

      await expect(
        servicio.actualizarPadre('A', ACTOR, { actividadPadreId: 'C' }),
      ).rejects.toThrow(/formaria un ciclo/i);

      expect(prisma.actividad.update).not.toHaveBeenCalled();
    });

    it('acepta un padre valido y deja de recorrer al llegar a la raiz', async () => {
      prisma.actividad.findUnique.mockResolvedValue({
        actividadPadreId: null,
      } as never);

      await servicio.actualizarPadre('A', ACTOR, { actividadPadreId: 'B' });

      expect(prisma.actividad.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'A' },
          data: { actividadPadreId: 'B' },
        }),
      );
    });

    it('con padre null la vuelve raiz sin validar nada', async () => {
      prisma.actividad.findFirst.mockReset();
      prisma.actividad.findFirst.mockResolvedValueOnce(ACTIVIDAD as never);

      await servicio.actualizarPadre('A', ACTOR, { actividadPadreId: null });

      expect(prisma.actividad.findUnique).not.toHaveBeenCalled();
      expect(prisma.actividad.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { actividadPadreId: null } }),
      );
    });

    it('DOCUMENTA EL LIMITE: la busqueda de ciclos corta a los 200 saltos', async () => {
      // Cadena mas profunda que el tope: el recorrido se agota sin encontrar
      // la tarea y el cambio se ACEPTA. Si algun dia eso se considera un
      // agujero, este test es el que cae al corregirlo.
      prisma.actividad.findUnique.mockResolvedValue({
        actividadPadreId: 'otro-mas-arriba',
      } as never);

      await servicio.actualizarPadre('A', ACTOR, { actividadPadreId: 'B' });

      expect(prisma.actividad.findUnique).toHaveBeenCalledTimes(200);
      expect(prisma.actividad.update).toHaveBeenCalled();
    });
  });

  describe('crear', () => {
    it('deja la tarea nueva al final de sus hermanas', async () => {
      prisma.proyecto.findFirst.mockResolvedValue({ id: 'p1' } as never);
      prisma.actividad.findFirst
        .mockResolvedValueOnce({ id: 'padre' } as never) // el padre existe
        .mockResolvedValueOnce({ orden: 4 } as never); // ultima hermana

      await servicio.crear(ACTOR, {
        proyectoId: 'p1',
        titulo: 'Nueva',
        actividadPadreId: 'padre',
      });

      expect(prisma.actividad.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ orden: 5 }) }),
      );
    });

    it('la primera hija parte en orden 0', async () => {
      prisma.proyecto.findFirst.mockResolvedValue({ id: 'p1' } as never);
      prisma.actividad.findFirst.mockResolvedValueOnce(null as never);

      await servicio.crear(ACTOR, { proyectoId: 'p1', titulo: 'Primera' });

      expect(prisma.actividad.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ orden: 0 }) }),
      );
    });

    it('anota a quien la crea, que ademas queda como responsable', async () => {
      prisma.proyecto.findFirst.mockResolvedValue({ id: 'p1' } as never);
      prisma.actividad.findFirst.mockResolvedValueOnce(null as never);

      await servicio.crear(ACTOR, { proyectoId: 'p1', titulo: 'Mia' });

      expect(prisma.actividad.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ creadoPorId: USUARIO, responsableId: USUARIO }),
        }),
      );
    });
  });

  describe('exigirEvidencia', () => {
    it('los adjuntos quitados no cuentan como respaldo', async () => {
      prisma.evidencia.count.mockResolvedValue(0 as never);

      await expect(servicio.exigirEvidencia('A')).rejects.toThrow(BadRequestException);
      expect(prisma.evidencia.count).toHaveBeenCalledWith({
        where: { actividadId: 'A', eliminadaEn: null },
      });
    });
  });

  describe('actualizarInstrucciones', () => {
    const tarea = (creadoPorId: string | null) => ({
      id: 'A',
      descripcion: 'antes',
      creadoPorId,
      proyecto: { organizacionId: 'org-1' },
    });
    const ADMIN = { ...ACTOR, id: 'admin-1', rol: 'ADMINISTRADOR' } as UsuarioActual;

    beforeEach(() => {
      prisma.$queryRaw.mockResolvedValue([] as never);
    });

    it('quien creo la tarea puede editarlas; se guardan sin espacios sobrantes', async () => {
      prisma.actividad.findFirst
        .mockResolvedValueOnce(tarea(USUARIO) as never)
        .mockResolvedValueOnce({ id: 'A', creadoPorId: USUARIO } as never);

      const resultado = await servicio.actualizarInstrucciones('A', ACTOR, {
        instrucciones: '  Revisar el contrato  ',
      });

      expect(prisma.actividad.update).toHaveBeenCalledWith({
        where: { id: 'A' },
        data: { descripcion: 'Revisar el contrato' },
      });
      expect(resultado.puedeEditarInstrucciones).toBe(true);
    });

    it('el administrador tambien puede, aunque no la haya creado', async () => {
      prisma.actividad.findFirst
        .mockResolvedValueOnce(tarea('otro') as never)
        .mockResolvedValueOnce({ id: 'A', creadoPorId: 'otro' } as never);

      await servicio.actualizarInstrucciones('A', ADMIN, { instrucciones: 'x' });

      expect(prisma.actividad.update).toHaveBeenCalled();
    });

    it('rechaza a quien no la creo ni es administrador', async () => {
      prisma.actividad.findFirst.mockResolvedValueOnce(tarea('otro') as never);

      await expect(
        servicio.actualizarInstrucciones('A', ACTOR, { instrucciones: 'x' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.actividad.update).not.toHaveBeenCalled();
    });

    it('una tarea sin creador conocido solo la edita el administrador', async () => {
      prisma.actividad.findFirst.mockResolvedValueOnce(tarea(null) as never);

      await expect(
        servicio.actualizarInstrucciones('A', ACTOR, { instrucciones: 'x' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('un texto vacio quita las instrucciones y queda auditado', async () => {
      prisma.actividad.findFirst
        .mockResolvedValueOnce(tarea(USUARIO) as never)
        .mockResolvedValueOnce({ id: 'A', creadoPorId: USUARIO } as never);

      await servicio.actualizarInstrucciones('A', ACTOR, { instrucciones: '   ' });

      expect(prisma.actividad.update).toHaveBeenCalledWith({
        where: { id: 'A' },
        data: { descripcion: null },
      });
      expect(prisma.registroAuditoria.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accion: 'ACTIVIDAD_INSTRUCCIONES',
          valorAnterior: { descripcion: 'antes' },
          valorNuevo: { descripcion: null },
        }),
      });
    });

    it('no encuentra tareas de otra organizacion', async () => {
      prisma.actividad.findFirst.mockResolvedValueOnce(null as never);

      await expect(
        servicio.actualizarInstrucciones('A', ACTOR, { instrucciones: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.actividad.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ proyecto: { organizacionId: 'org-1' } }),
        }),
      );
    });
  });

  describe('guardarPosiciones (mapa de nodos en modo edicion)', () => {
    const nodo = (id: string, posicionNodo: unknown = null, proyectoId = 'p1') => ({
      id,
      proyectoId,
      posicionNodo,
    });
    const datosGuardados = () =>
      prisma.actividad.update.mock.calls.map(([arg]) => [arg.where.id, arg.data.posicionNodo]);

    it('rechaza un nodo repetido sin consultar la base', async () => {
      await expect(
        servicio.guardarPosiciones(ACTOR, {
          orientacion: 'vertical',
          cambios: [{ id: 'a', posicion: { x: 1, y: 2 } }, { id: 'a', posicion: null }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.actividad.findMany).not.toHaveBeenCalled();
    });

    it('rechaza un nodo inexistente o de otra organizacion', async () => {
      prisma.actividad.findMany.mockResolvedValue([nodo('a')] as never);

      await expect(
        servicio.guardarPosiciones(ACTOR, {
          orientacion: 'vertical',
          cambios: [{ id: 'a', posicion: { x: 1, y: 2 } }, { id: 'b', posicion: { x: 3, y: 4 } }],
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.actividad.update).not.toHaveBeenCalled();
    });

    it('rechaza mezclar nodos de distintos proyectos', async () => {
      prisma.actividad.findMany.mockResolvedValue([nodo('a'), nodo('b', null, 'p2')] as never);

      await expect(
        servicio.guardarPosiciones(ACTOR, {
          orientacion: 'vertical',
          cambios: [{ id: 'a', posicion: { x: 1, y: 2 } }, { id: 'b', posicion: { x: 3, y: 4 } }],
        }),
      ).rejects.toThrow(/mismo proyecto/i);
    });

    it('guarda la posicion de la orientacion sin tocar la de la otra', async () => {
      prisma.actividad.findMany.mockResolvedValue([
        nodo('a', { horizontal: { x: 10, y: 20 } }),
      ] as never);

      await servicio.guardarPosiciones(ACTOR, {
        orientacion: 'vertical',
        cambios: [{ id: 'a', posicion: { x: -50, y: 120 } }],
      });

      expect(datosGuardados()).toEqual([
        ['a', { horizontal: { x: 10, y: 20 }, vertical: { x: -50, y: 120 } }],
      ]);
    });

    it('descarta el formato suelto { x, y } que dejaba el seed', async () => {
      prisma.actividad.findMany.mockResolvedValue([nodo('a', { x: 320, y: 140 })] as never);

      await servicio.guardarPosiciones(ACTOR, {
        orientacion: 'horizontal',
        cambios: [{ id: 'a', posicion: { x: 5, y: 6 } }],
      });

      expect(datosGuardados()).toEqual([['a', { horizontal: { x: 5, y: 6 } }]]);
    });

    it('con posicion null borra solo esa orientacion, y vacia el campo si no queda nada', async () => {
      prisma.actividad.findMany.mockResolvedValue([
        nodo('a', { horizontal: { x: 1, y: 1 }, vertical: { x: 2, y: 2 } }),
        nodo('b', { vertical: { x: 3, y: 3 } }),
      ] as never);

      await servicio.guardarPosiciones(ACTOR, {
        orientacion: 'vertical',
        cambios: [{ id: 'a', posicion: null }, { id: 'b', posicion: null }],
      });

      expect(datosGuardados()).toEqual([
        ['a', { horizontal: { x: 1, y: 1 } }],
        ['b', Prisma.DbNull],
      ]);
    });
  });

  describe('reasignar (US-06: derivaciones con motivo)', () => {
    // Ahora se lee tambien la organizacion del proyecto, para no derivar la
    // tarea a alguien de otra empresa.
    const ACTIVIDAD = {
      id: 'A',
      proyectoId: 'p1',
      responsableId: USUARIO,
      proyecto: { organizacionId: 'org-1' },
    };

    it('rechaza derivar a quien ya es responsable', async () => {
      prisma.actividad.findFirst.mockResolvedValue(ACTIVIDAD as never);

      await expect(
        servicio.reasignar('A', ACTOR, { usuarioId: USUARIO, motivo: 'x' }),
      ).rejects.toThrow(/ya es responsable/i);
    });

    it('rechaza derivar a un usuario desactivado', async () => {
      prisma.actividad.findFirst.mockResolvedValue(ACTIVIDAD as never);
      prisma.usuario.findFirst.mockResolvedValue({ id: 'u2', activo: false } as never);

      await expect(
        servicio.reasignar('A', ACTOR, { usuarioId: 'u2', motivo: 'x' }),
      ).rejects.toThrow(/desactivado/i);
    });

    it('registra la derivacion con su motivo recortado', async () => {
      prisma.actividad.findFirst
        .mockResolvedValueOnce(ACTIVIDAD as never)
        .mockResolvedValueOnce({ id: 'A' } as never); // el detalle() final
      prisma.usuario.findFirst.mockResolvedValue({ id: 'u2', activo: true } as never);
      prisma.miembroProyecto.findUnique.mockResolvedValue(null as never);
      prisma.$queryRaw.mockResolvedValue([] as never);

      await servicio.reasignar('A', ACTOR, {
        usuarioId: 'u2',
        motivo: '  se va de vacaciones  ',
      });

      expect(prisma.derivacion.create).toHaveBeenCalledWith({
        data: {
          actividadId: 'A',
          deUsuarioId: USUARIO,
          aUsuarioId: 'u2',
          motivo: 'se va de vacaciones',
        },
      });
    });

    it('suma al proyecto a quien recibe la tarea y no era miembro', async () => {
      prisma.actividad.findFirst
        .mockResolvedValueOnce(ACTIVIDAD as never)
        .mockResolvedValueOnce({ id: 'A' } as never);
      prisma.usuario.findFirst.mockResolvedValue({ id: 'u2', activo: true } as never);
      prisma.miembroProyecto.findUnique.mockResolvedValue(null as never);
      prisma.$queryRaw.mockResolvedValue([] as never);

      await servicio.reasignar('A', ACTOR, { usuarioId: 'u2', motivo: 'x' });

      expect(prisma.miembroProyecto.create).toHaveBeenCalledWith({
        data: { proyectoId: 'p1', usuarioId: 'u2' },
      });
    });

    it('no duplica la membresia si ya pertenecia al proyecto', async () => {
      prisma.actividad.findFirst
        .mockResolvedValueOnce(ACTIVIDAD as never)
        .mockResolvedValueOnce({ id: 'A' } as never);
      prisma.usuario.findFirst.mockResolvedValue({ id: 'u2', activo: true } as never);
      prisma.miembroProyecto.findUnique.mockResolvedValue({
        usuarioId: 'u2',
      } as never);
      prisma.$queryRaw.mockResolvedValue([] as never);

      await servicio.reasignar('A', ACTOR, { usuarioId: 'u2', motivo: 'x' });

      expect(prisma.miembroProyecto.create).not.toHaveBeenCalled();
    });
  });
});
