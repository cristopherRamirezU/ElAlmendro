-- Quien creo cada tarea: puede agregar o editar sus instrucciones despues de
-- crearla. Nulo si no se puede deducir.
ALTER TABLE "actividades" ADD COLUMN IF NOT EXISTS "creadoPorId" UUID;

ALTER TABLE "actividades" ADD CONSTRAINT "actividades_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Historico: al crear una tarea su responsable es quien la crea. Si despues se
-- derivo, la primera derivacion dice quien era el responsable original; si
-- nunca se derivo, sigue siendo el responsable actual.
UPDATE "actividades" a
   SET "creadoPorId" = COALESCE(
         (SELECT d."deUsuarioId"
            FROM "derivaciones" d
           WHERE d."actividadId" = a.id
           ORDER BY d."ocurridoEn" ASC
           LIMIT 1),
         a."responsableId"
       )
 WHERE a."creadoPorId" IS NULL;
