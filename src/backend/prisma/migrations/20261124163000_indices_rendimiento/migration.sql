CREATE INDEX IF NOT EXISTS "proyectos_propietarioId_idx" ON "proyectos"("propietarioId");
CREATE INDEX IF NOT EXISTS "miembros_proyecto_usuarioId_idx" ON "miembros_proyecto"("usuarioId");
CREATE INDEX IF NOT EXISTS "actividades_proyectoId_eliminadoEn_idx" ON "actividades"("proyectoId", "eliminadoEn");
CREATE INDEX IF NOT EXISTS "actividades_responsableId_eliminadoEn_idx" ON "actividades"("responsableId", "eliminadoEn");
CREATE INDEX IF NOT EXISTS "jornadas_usuarioId_estado_idx" ON "jornadas"("usuarioId", "estado");
CREATE INDEX IF NOT EXISTS "sesiones_trabajo_jornadaId_idx" ON "sesiones_trabajo"("jornadaId");
CREATE INDEX IF NOT EXISTS "sesiones_trabajo_usuarioId_estado_idx" ON "sesiones_trabajo"("usuarioId", "estado");
