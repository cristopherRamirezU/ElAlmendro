-- AlterTable proyectos: agregar borrado logico
ALTER TABLE "proyectos" ADD COLUMN IF NOT EXISTS "eliminadoEn" TIMESTAMPTZ(3);
CREATE INDEX IF NOT EXISTS "proyectos_organizacionId_eliminadoEn_idx" ON "proyectos"("organizacionId", "eliminadoEn");
