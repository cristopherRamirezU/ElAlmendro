-- Multi-Tenant SaaS Migration

-- 1. Agregar rol SUPER_ADMIN
ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

-- 2. Crear enum PlanSaaS
DO $$ BEGIN
    CREATE TYPE "PlanSaaS" AS ENUM ('GRATIS', 'PRO', 'EMPRESA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Crear tabla organizaciones
CREATE TABLE IF NOT EXISTS "organizaciones" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "rut" TEXT,
    "plan" "PlanSaaS" NOT NULL DEFAULT 'GRATIS',
    "maxUsuarios" INTEGER NOT NULL DEFAULT 10,
    "maxProyectos" INTEGER NOT NULL DEFAULT 5,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizaciones_pkey" PRIMARY KEY ("id")
);

-- Indices unicos organizaciones
CREATE UNIQUE INDEX IF NOT EXISTS "organizaciones_slug_key" ON "organizaciones"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "organizaciones_rut_key" ON "organizaciones"("rut");

-- Insercion de organizacion por defecto 'El Almendro'
INSERT INTO "organizaciones" ("id", "nombre", "slug", "plan", "maxUsuarios", "maxProyectos", "activo")
VALUES ('a0000000-0000-0000-0000-000000000001', 'El Almendro', 'el-almendro', 'EMPRESA', 100, 50, true)
ON CONFLICT ("slug") DO NOTHING;

-- 4. Modificar tabla usuarios
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "organizacionId" UUID;
UPDATE "usuarios" SET "organizacionId" = 'a0000000-0000-0000-0000-000000000001' WHERE "organizacionId" IS NULL;
CREATE INDEX IF NOT EXISTS "usuarios_organizacionId_activo_idx" ON "usuarios"("organizacionId", "activo");

DO $$ BEGIN
    ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. Modificar tabla proyectos
ALTER TABLE "proyectos" ADD COLUMN IF NOT EXISTS "organizacionId" UUID;
UPDATE "proyectos" SET "organizacionId" = 'a0000000-0000-0000-0000-000000000001' WHERE "organizacionId" IS NULL;
ALTER TABLE "proyectos" ALTER COLUMN "organizacionId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "proyectos_organizacionId_estado_idx" ON "proyectos"("organizacionId", "estado");

DO $$ BEGIN
    ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 6. Modificar tabla jornadas
ALTER TABLE "jornadas" ADD COLUMN IF NOT EXISTS "organizacionId" UUID;
UPDATE "jornadas" SET "organizacionId" = 'a0000000-0000-0000-0000-000000000001' WHERE "organizacionId" IS NULL;
ALTER TABLE "jornadas" ALTER COLUMN "organizacionId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "jornadas_organizacionId_inicioEn_idx" ON "jornadas"("organizacionId", "inicioEn");

DO $$ BEGIN
    ALTER TABLE "jornadas" ADD CONSTRAINT "jornadas_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 7. Modificar tabla mensajes_chat
ALTER TABLE "mensajes_chat" ADD COLUMN IF NOT EXISTS "organizacionId" UUID;
UPDATE "mensajes_chat" SET "organizacionId" = 'a0000000-0000-0000-0000-000000000001' WHERE "organizacionId" IS NULL;
ALTER TABLE "mensajes_chat" ALTER COLUMN "organizacionId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "mensajes_chat_organizacionId_creadoEn_idx" ON "mensajes_chat"("organizacionId", "creadoEn");

DO $$ BEGIN
    ALTER TABLE "mensajes_chat" ADD CONSTRAINT "mensajes_chat_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 8. Modificar tabla registros_auditoria
ALTER TABLE "registros_auditoria" ADD COLUMN IF NOT EXISTS "organizacionId" UUID;
CREATE INDEX IF NOT EXISTS "registros_auditoria_organizacionId_ocurridoEn_idx" ON "registros_auditoria"("organizacionId", "ocurridoEn");

DO $$ BEGIN
    ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
