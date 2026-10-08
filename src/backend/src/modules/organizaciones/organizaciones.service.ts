import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CrearOrganizacionDto } from './dto/crear-organizacion.dto';
import { ActualizarOrganizacionDto } from './dto/actualizar-organizacion.dto';
import { PlanSaaS, Rol } from '@prisma/client';
import { esViolacionUnica, normalizarCorreo, normalizarRut } from '../../common/organizacion';
import { UsuarioActual } from '../../common/usuario-actual.decorator';

@Injectable()
export class OrganizacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(buscar?: string, activo?: boolean) {
    const where: any = {};
    if (activo !== undefined) {
      where.activo = activo;
    }
    if (buscar && buscar.trim().length > 0) {
      const q = buscar.trim();
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { rut: { contains: q, mode: 'insensitive' } },
      ];
    }

    const organizaciones = await this.prisma.organizacion.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      include: {
        _count: {
          select: {
            usuarios: { where: { activo: true } },
            proyectos: { where: { eliminadoEn: null } },
          },
        },
      },
    });

    return organizaciones.map((org) => ({
      id: org.id,
      nombre: org.nombre,
      slug: org.slug,
      rut: org.rut,
      plan: org.plan,
      maxUsuarios: org.maxUsuarios,
      maxProyectos: org.maxProyectos,
      activo: org.activo,
      creadoEn: org.creadoEn,
      actualizadoEn: org.actualizadoEn,
      totalUsuarios: org._count.usuarios,
      totalProyectos: org._count.proyectos,
    }));
  }

  async obtenerPorId(id: string) {
    const org = await this.prisma.organizacion.findUnique({
      where: { id },
      include: {
        usuarios: {
          select: {
            id: true,
            email: true,
            nombreCompleto: true,
            rol: true,
            activo: true,
            creadoEn: true,
          },
          orderBy: { creadoEn: 'desc' },
        },
        proyectos: {
          where: { eliminadoEn: null },
          select: {
            id: true,
            nombre: true,
            estado: true,
            creadoEn: true,
          },
          orderBy: { creadoEn: 'desc' },
        },
        _count: {
          select: {
            usuarios: { where: { activo: true } },
            proyectos: { where: { eliminadoEn: null } },
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organización no encontrada.');
    }

    return {
      ...org,
      totalUsuarios: org._count.usuarios,
      totalProyectos: org._count.proyectos,
    };
  }

  async crear(dto: CrearOrganizacionDto, actorId?: string) {
    const slug = dto.slug.toLowerCase().trim();
    const rut = dto.rut?.trim() ? normalizarRut(dto.rut) : null;
    const adminEmail = dto.adminEmail?.trim() ? normalizarCorreo(dto.adminEmail) : null;

    // El administrador inicial va completo o no va: un correo sin clave
    // dejaria una cuenta imposible de usar.
    if (Boolean(adminEmail) !== Boolean(dto.adminPassword)) {
      throw new BadRequestException(
        'Para crear el administrador inicial se requieren correo y contraseña.',
      );
    }

    const existeSlug = await this.prisma.organizacion.findUnique({
      where: { slug },
    });
    if (existeSlug) {
      throw new ConflictException(`Ya existe una organización con el slug "${slug}".`);
    }

    if (rut) {
      const existeRut = await this.prisma.organizacion.findUnique({ where: { rut } });
      if (existeRut) {
        throw new ConflictException(`Ya existe una organización con el RUT "${rut}".`);
      }
    }

    // El correo del admin es unico en toda la plataforma: si ya pertenece a
    // cualquier cuenta, de esta u otra empresa, no se reutiliza.
    if (adminEmail) {
      const existeEmail = await this.prisma.usuario.findUnique({ where: { email: adminEmail } });
      if (existeEmail) {
        throw new ConflictException(
          `El correo "${adminEmail}" ya está registrado en la plataforma. Usa un correo distinto para el administrador.`,
        );
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      const org = await tx.organizacion.create({
        data: {
          nombre: dto.nombre.trim(),
          slug,
          rut,
          plan: dto.plan ?? PlanSaaS.GRATIS,
          maxUsuarios: dto.maxUsuarios ?? 10,
          maxProyectos: dto.maxProyectos ?? 5,
          activo: true,
        },
      });

      if (adminEmail && dto.adminPassword) {
        const hash = await argon2.hash(dto.adminPassword);
        await tx.usuario.create({
          data: {
            email: adminEmail,
            hashContrasena: hash,
            nombreCompleto: (dto.adminNombre || 'Administrador').trim(),
            rol: Rol.ADMINISTRADOR,
            organizacionId: org.id,
          },
        });
      }

      await tx.registroAuditoria.create({
        data: {
          actorId: actorId ?? null,
          organizacionId: org.id,
          accion: 'ORGANIZACION_CREADA',
          tipoEntidad: 'Organizacion',
          entidadId: org.id,
          valorNuevo: { nombre: org.nombre, slug: org.slug, plan: org.plan } as any,
        },
      });

      return org;
    }).catch((error) => {
      // Carrera entre dos altas simultaneas: la base impone la unicidad.
      if (esViolacionUnica(error)) {
        throw new ConflictException('El slug, el RUT o el correo del administrador ya están registrados.');
      }
      throw error;
    });
  }

  async actualizar(id: string, dto: ActualizarOrganizacionDto, actorId?: string) {
    const org = await this.prisma.organizacion.findUnique({
      where: { id },
    });
    if (!org) {
      throw new NotFoundException('Organización no encontrada.');
    }

    const rut = dto.rut?.trim() ? normalizarRut(dto.rut) : null;
    if (rut && rut !== org.rut) {
      const existeRut = await this.prisma.organizacion.findUnique({ where: { rut } });
      if (existeRut && existeRut.id !== id) {
        throw new ConflictException(`Ya existe una organización con el RUT "${rut}".`);
      }
    }

    const data: any = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre.trim();
    if (dto.rut !== undefined) data.rut = rut;
    if (dto.plan !== undefined) data.plan = dto.plan;
    if (dto.maxUsuarios !== undefined) data.maxUsuarios = dto.maxUsuarios;
    if (dto.maxProyectos !== undefined) data.maxProyectos = dto.maxProyectos;
    if (dto.activo !== undefined) data.activo = dto.activo;

    const actualizada = await this.prisma.organizacion.update({
      where: { id },
      data,
    });

    await this.prisma.registroAuditoria.create({
      data: {
        actorId: actorId ?? null,
        organizacionId: id,
        accion: 'ORGANIZACION_ACTUALIZADA',
        tipoEntidad: 'Organizacion',
        entidadId: id,
        valorAnterior: { plan: org.plan, activo: org.activo, maxUsuarios: org.maxUsuarios } as any,
        valorNuevo: data as any,
      },
    });

    return actualizada;
  }

  /**
   * Autoservicio del Administrador de la empresa: solo su propio nombre y
   * color, sin el detalle de usuarios ni proyectos que trae `obtenerPorId`
   * (eso es exclusivo del panel Super Admin).
   */
  async obtenerMia(u: UsuarioActual) {
    if (!u.organizacionId) {
      throw new BadRequestException('Esta cuenta no pertenece a ninguna organización.');
    }
    const org = await this.prisma.organizacion.findUnique({
      where: { id: u.organizacionId },
      select: { id: true, nombre: true, colorPrimario: true, temaFondo: true },
    });
    if (!org) throw new NotFoundException('Organización no encontrada.');
    return org;
  }

  async actualizarColorPropio(
    u: UsuarioActual,
    datos: { colorPrimario: string; temaFondo?: string },
  ) {
    if (!u.organizacionId) {
      throw new BadRequestException('Esta cuenta no pertenece a ninguna organización.');
    }

    const data: { colorPrimario: string; temaFondo?: string } = {
      colorPrimario: datos.colorPrimario,
    };
    if (datos.temaFondo !== undefined) data.temaFondo = datos.temaFondo;

    const actualizada = await this.prisma.organizacion.update({
      where: { id: u.organizacionId },
      data,
      select: { id: true, nombre: true, colorPrimario: true, temaFondo: true },
    });

    await this.prisma.registroAuditoria.create({
      data: {
        actorId: u.id,
        organizacionId: u.organizacionId,
        accion: 'ORGANIZACION_COLOR_ACTUALIZADO',
        tipoEntidad: 'Organizacion',
        entidadId: u.organizacionId,
        valorNuevo: data as any,
      },
    });

    return actualizada;
  }

  async obtenerMetricasGlobales() {
    const [totalOrganizaciones, activas, inactivas, totalUsuarios, totalProyectos, planes] =
      await Promise.all([
        this.prisma.organizacion.count(),
        this.prisma.organizacion.count({ where: { activo: true } }),
        this.prisma.organizacion.count({ where: { activo: false } }),
        this.prisma.usuario.count({ where: { rol: { not: Rol.SUPER_ADMIN }, activo: true } }),
        this.prisma.proyecto.count({ where: { eliminadoEn: null } }),
        this.prisma.organizacion.groupBy({
          by: ['plan'],
          _count: { id: true },
        }),
      ]);

    const distribucionPlanes: Record<string, number> = {
      GRATIS: 0,
      PRO: 0,
      EMPRESA: 0,
    };

    planes.forEach((p) => {
      distribucionPlanes[p.plan] = p._count.id;
    });

    return {
      totalOrganizaciones,
      activas,
      inactivas,
      totalUsuarios,
      totalProyectos,
      distribucionPlanes,
    };
  }
}
