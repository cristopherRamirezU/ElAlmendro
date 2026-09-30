/**
 * Creacion manual de usuarios.
 *
 * Utilidad provisional, mientras no exista el modulo `usuarios` con su pantalla
 * de administracion. Su unica razon de ser es calcular el hash Argon2id de la
 * contrasena: la base guarda el hash y nunca la contrasena, de modo que un
 * usuario insertado a mano con texto plano jamas podria iniciar sesion.
 *
 * Uso, desde la raiz del repositorio:
 *
 *   npm run usuario:crear -- <correo> "<nombre completo>" <contrasena> [rol] [slug-organizacion]
 *
 * El rol puede ser TRABAJADOR (por defecto), SUPERVISOR, ADMINISTRADOR o
 * SUPER_ADMIN. Salvo SUPER_ADMIN, la cuenta pertenece a una organizacion: si
 * hay mas de una registrada, su slug es obligatorio (nunca se adivina).
 *
 * Ejemplo:
 *   npm run usuario:crear -- cristopher@timeflow.cl "Cristopher Ramirez" Clave123! ADMINISTRADOR el-almendro
 */
import { PrismaClient, Rol } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

function abortar(mensaje: string): never {
  console.error(`\n  ${mensaje}\n`);
  console.error('  Uso: npm run usuario:crear -- <correo> "<nombre>" <clave> [rol] [slug-organizacion]\n');
  process.exit(1);
}

async function main() {
  const [correo, nombre, clave, rolPedido = 'TRABAJADOR', slugPedido] = process.argv.slice(2);

  if (!correo || !nombre || !clave) {
    abortar('Faltan datos: se necesitan correo, nombre y contrasena.');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
    abortar(`El correo "${correo}" no tiene un formato valido.`);
  }
  if (clave.length < 8) {
    abortar('La contrasena debe tener al menos 8 caracteres.');
  }

  const rol = rolPedido.toUpperCase();
  if (rol !== 'TRABAJADOR' && rol !== 'ADMINISTRADOR' && rol !== 'SUPERVISOR' && rol !== 'SUPER_ADMIN') {
    abortar(`Rol no valido: "${rolPedido}". Usa TRABAJADOR, SUPERVISOR, ADMINISTRADOR o SUPER_ADMIN.`);
  }

  const email = correo.toLowerCase().trim();

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    abortar(`El correo ${email} ya esta registrado en la plataforma (cada correo es una sola cuenta).`);
  }

  let organizacionId: string | null = null;
  if (rol !== 'SUPER_ADMIN') {
    const organizaciones = await prisma.organizacion.findMany({ select: { id: true, slug: true } });
    const org = slugPedido
      ? organizaciones.find((o) => o.slug === slugPedido.toLowerCase().trim())
      : organizaciones.length === 1
        ? organizaciones[0]
        : undefined;
    if (!org) {
      abortar(
        slugPedido
          ? `No existe la organizacion "${slugPedido}".`
          : `Indica la organizacion: ${organizaciones.map((o) => o.slug).join(', ')}.`,
      );
    }
    organizacionId = org.id;
  }

  const usuario = await prisma.usuario.create({
    data: {
      email,
      nombreCompleto: nombre.trim(),
      hashContrasena: await argon2.hash(clave),
      rol: rol as Rol,
      organizacionId,
    },
  });

  await prisma.registroAuditoria.create({
    data: {
      organizacionId,
      accion: 'USUARIO_CREADO',
      tipoEntidad: 'Usuario',
      entidadId: usuario.id,
      valorNuevo: { email: usuario.email, rol: usuario.rol },
    },
  });

  console.log('\n  Usuario creado.\n');
  console.log(`    Correo : ${usuario.email}`);
  console.log(`    Nombre : ${usuario.nombreCompleto}`);
  console.log(`    Rol    : ${usuario.rol}`);
  console.log(`    Id     : ${usuario.id}\n`);
  console.log('  Ya puede iniciar sesion en http://localhost:3000\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
