-- Foto de perfil por usuario (version vigente; el archivo vive en S3).
ALTER TABLE "usuarios" ADD COLUMN "fotoPerfil" TEXT;

-- La zona horaria de cada persona pasa a usarse dentro de las consultas
-- (AT TIME ZONE "zonaHoraria"). Antes se aceptaba texto libre: un valor que
-- PostgreSQL no reconoce haria fallar esas consultas, asi que vuelve al
-- valor por defecto.
UPDATE "usuarios"
   SET "zonaHoraria" = 'America/Santiago'
 WHERE "zonaHoraria" NOT IN (SELECT name FROM pg_timezone_names);
