-- Borrado logico de adjuntos: la base prohibe eliminar evidencias (regla 9 de
-- reglas-integridad.sql), asi que "eliminar" un adjunto lo marca. Deja de
-- verse y de contar como respaldo, pero el registro y el archivo quedan.
ALTER TABLE "evidencias" ADD COLUMN IF NOT EXISTS "eliminadaEn" TIMESTAMPTZ(3);
ALTER TABLE "evidencias" ADD COLUMN IF NOT EXISTS "eliminadaPorId" UUID;

ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_eliminadaPorId_fkey" FOREIGN KEY ("eliminadaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
