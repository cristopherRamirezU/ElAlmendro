-- Comentarios de voz: de uno por tarea (columnas en actividades) a una lista
-- donde cada persona graba los suyos.
CREATE TABLE "audios_comentario" (
    "id" UUID NOT NULL,
    "actividadId" UUID NOT NULL,
    "autorId" UUID NOT NULL,
    "claveObjeto" TEXT NOT NULL,
    "tipoMime" TEXT NOT NULL,
    "segundos" INTEGER,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audios_comentario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "audios_comentario_claveObjeto_key" ON "audios_comentario"("claveObjeto");
CREATE INDEX "audios_comentario_actividadId_creadoEn_idx" ON "audios_comentario"("actividadId", "creadoEn");

ALTER TABLE "audios_comentario" ADD CONSTRAINT "audios_comentario_actividadId_fkey"
    FOREIGN KEY ("actividadId") REFERENCES "actividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audios_comentario" ADD CONSTRAINT "audios_comentario_autorId_fkey"
    FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- El audio unico que ya existia pasa a la lista, conservando su archivo. Lo
-- grabo quien podia editar los comentarios: se atribuye a quien creo la tarea
-- (o al responsable, si la tarea antigua no registra creador). El tipo se
-- deduce despues al servirlo; aqui queda el mas comun.
INSERT INTO "audios_comentario" ("id", "actividadId", "autorId", "claveObjeto", "tipoMime", "segundos", "creadoEn")
SELECT gen_random_uuid(),
       a."id",
       COALESCE(a."creadoPorId", a."responsableId"),
       'audios-comentario/' || a."id" || '/' || a."audioComentario",
       'audio/webm',
       a."audioComentarioSegundos",
       a."actualizadoEn"
  FROM "actividades" a
 WHERE a."audioComentario" IS NOT NULL;

ALTER TABLE "actividades" DROP COLUMN "audioComentario";
ALTER TABLE "actividades" DROP COLUMN "audioComentarioSegundos";
