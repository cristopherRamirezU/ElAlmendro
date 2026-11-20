-- Comentario de voz de la tarea (version vigente y duracion; el audio vive en S3).
ALTER TABLE "actividades" ADD COLUMN "audioComentario" TEXT;
ALTER TABLE "actividades" ADD COLUMN "audioComentarioSegundos" INTEGER;
