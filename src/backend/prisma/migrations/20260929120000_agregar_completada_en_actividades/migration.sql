-- Fecha en que una tarea se guardo en el cofre (COMPLETADA): cierra la barra
-- de la tarea en la carta Gantt del proyecto.
ALTER TABLE "actividades" ADD COLUMN IF NOT EXISTS "completadaEn" TIMESTAMPTZ(3);

-- Historico: las tareas ya completadas toman el ultimo momento en que se
-- guardaron, sea desde la bolsa (auditoria) o al cerrar su cronometro. Si no
-- quedo rastro, su ultima modificacion.
UPDATE "actividades" a
   SET "completadaEn" = COALESCE(
         GREATEST(
           (SELECT MAX(r."ocurridoEn")
              FROM "registros_auditoria" r
             WHERE r."tipoEntidad" = 'Actividad'
               AND r."entidadId" = a.id::text
               AND r."accion" = 'ACTIVIDAD_CAMBIO_ESTADO'
               AND r."valorNuevo"->>'estado' = 'COMPLETADA'),
           (SELECT MAX(s."terminoEn")
              FROM "sesiones_trabajo" s
             WHERE s."actividadId" = a.id
               AND s."desenlace" = 'COMPLETADA')
         ),
         a."actualizadoEn"
       )
 WHERE a."estado" = 'COMPLETADA'
   AND a."completadaEn" IS NULL;
