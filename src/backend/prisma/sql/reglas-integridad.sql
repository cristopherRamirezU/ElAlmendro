-- ---------------------------------------------------------------------------
-- TimeFlow - reglas de integridad exigidas al motor
-- Fuente: "Arquitectura del Sistema TimeFlow", seccion 4.4.1.
--
-- Estas invariantes NO se implementan solo en la aplicacion: su violacion
-- comprometeria la credibilidad del registro de tiempo, de modo que no deben
-- depender de la correccion del codigo.
--
-- Este archivo es idempotente: se puede ejecutar todas las veces que haga
-- falta. Se aplica automaticamente despues de cada `prisma migrate`.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Un trabajador no puede tener mas de una sesion activa.
--    Indice unico parcial sobre usuarioId con condicion de estado activo.
DROP INDEX IF EXISTS ux_sesion_activa_por_usuario;
CREATE UNIQUE INDEX ux_sesion_activa_por_usuario
  ON sesiones_trabajo ("usuarioId")
  WHERE estado IN ('ACTIVA', 'PAUSADA');

-- 2. Un trabajador no puede tener mas de una jornada abierta.
DROP INDEX IF EXISTS ux_jornada_abierta_por_usuario;
CREATE UNIQUE INDEX ux_jornada_abierta_por_usuario
  ON jornadas ("usuarioId")
  WHERE "terminoEn" IS NULL;

-- 3. El termino debe ser posterior al inicio (sesiones, tramos y jornadas).
ALTER TABLE jornadas DROP CONSTRAINT IF EXISTS ck_jornada_termino_posterior;
ALTER TABLE jornadas ADD CONSTRAINT ck_jornada_termino_posterior
  CHECK ("terminoEn" IS NULL OR "terminoEn" > "inicioEn");

ALTER TABLE sesiones_trabajo DROP CONSTRAINT IF EXISTS ck_sesion_termino_posterior;
ALTER TABLE sesiones_trabajo ADD CONSTRAINT ck_sesion_termino_posterior
  CHECK ("terminoEn" IS NULL OR "terminoEn" > "inicioEn");

ALTER TABLE tramos_sesion DROP CONSTRAINT IF EXISTS ck_tramo_termino_posterior;
ALTER TABLE tramos_sesion ADD CONSTRAINT ck_tramo_termino_posterior
  CHECK ("terminoEn" IS NULL OR "terminoEn" > "inicioEn");

-- 4. Los tramos de un mismo usuario no pueden solaparse.
--    Restriccion de exclusion mediante btree_gist: garantiza que la suma de
--    tramos represente tiempo real y no tiempo contabilizado dos veces.
ALTER TABLE tramos_sesion DROP CONSTRAINT IF EXISTS ex_tramos_sin_solape;
ALTER TABLE tramos_sesion ADD CONSTRAINT ex_tramos_sin_solape
  EXCLUDE USING gist (
    "usuarioId" WITH =,
    tstzrange("inicioEn", COALESCE("terminoEn", 'infinity'::timestamptz)) WITH &&
  );

-- 5. Una sesion inconclusa exige nota de cierre (flujo 5.2).
ALTER TABLE sesiones_trabajo DROP CONSTRAINT IF EXISTS ck_sesion_nota_si_inconclusa;
ALTER TABLE sesiones_trabajo ADD CONSTRAINT ck_sesion_nota_si_inconclusa
  CHECK (desenlace IS DISTINCT FROM 'INCONCLUSA' OR length(coalesce("notaCierre", '')) > 0);

-- 6. Una evidencia cuelga de una actividad o de una sesion, pero no de nada.
ALTER TABLE evidencias DROP CONSTRAINT IF EXISTS ck_evidencia_tiene_dueno;
ALTER TABLE evidencias ADD CONSTRAINT ck_evidencia_tiene_dueno
  CHECK ("actividadId" IS NOT NULL OR "sesionId" IS NOT NULL);

-- 7. La derivacion exige motivo no vacio (criterio de aceptacion de US-06).
ALTER TABLE derivaciones DROP CONSTRAINT IF EXISTS ck_derivacion_motivo;
ALTER TABLE derivaciones ADD CONSTRAINT ck_derivacion_motivo
  CHECK (length(btrim(motivo)) > 0);

-- 8. La auditoria es inmutable: solo escritura.
--    Se implementa con disparador porque en desarrollo la aplicacion usa el
--    mismo rol que las migraciones; en produccion se acompana ademas de
--    REVOKE UPDATE, DELETE ON registros_auditoria al rol de la aplicacion.
CREATE OR REPLACE FUNCTION fn_auditoria_inmutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La bitacora de auditoria es de solo escritura (%).', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_auditoria_inmutable ON registros_auditoria;
CREATE TRIGGER tg_auditoria_inmutable
  BEFORE UPDATE OR DELETE ON registros_auditoria
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria_inmutable();

-- 9. Las sesiones y evidencias no se eliminan. El borrado logico existe en
--    actividades (eliminadoEn) y en evidencias (eliminadaEn, al quitar un
--    adjunto): la evidencia debe permanecer disponible para revision.
CREATE OR REPLACE FUNCTION fn_prohibir_borrado() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Los registros de % no pueden eliminarse.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_no_borrar_sesiones ON sesiones_trabajo;
CREATE TRIGGER tg_no_borrar_sesiones
  BEFORE DELETE ON sesiones_trabajo
  FOR EACH ROW EXECUTE FUNCTION fn_prohibir_borrado();

DROP TRIGGER IF EXISTS tg_no_borrar_evidencias ON evidencias;
CREATE TRIGGER tg_no_borrar_evidencias
  BEFORE DELETE ON evidencias
  FOR EACH ROW EXECUTE FUNCTION fn_prohibir_borrado();

-- ---------------------------------------------------------------------------
-- 10. Aislamiento Multi-SaaS
--
-- La API ya acota cada consulta a la organizacion de la sesion. Estas reglas
-- son la segunda linea: aunque un error de codigo lo intentara, el motor no
-- deja que un dato de una empresa quede ligado a personas de otra.
--
-- Los CHECK se crean NOT VALID: rigen para toda fila nueva o modificada sin
-- bloquear el despliegue si quedara alguna fila historica irregular.
-- ---------------------------------------------------------------------------

-- 10.1 El correo es unico en toda la plataforma y se guarda en minusculas y
--      sin espacios. El indice unico de Prisma distingue mayusculas; con la
--      forma canonica obligatoria, "Ana@x.cl" y "ana@x.cl" ya no pueden
--      convivir como dos cuentas en empresas distintas.
UPDATE usuarios u
   SET email = lower(btrim(u.email))
 WHERE u.email <> lower(btrim(u.email))
   AND NOT EXISTS (SELECT 1 FROM usuarios o WHERE o.email = lower(btrim(u.email)));

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS ck_usuario_email_canonico;
ALTER TABLE usuarios ADD CONSTRAINT ck_usuario_email_canonico
  CHECK (email = lower(btrim(email))) NOT VALID;

-- 10.2 Fuera de SUPER_ADMIN no existe una cuenta sin empresa.
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS ck_usuario_con_organizacion;
ALTER TABLE usuarios ADD CONSTRAINT ck_usuario_con_organizacion
  CHECK (rol = 'SUPER_ADMIN' OR "organizacionId" IS NOT NULL) NOT VALID;

-- 10.3 Una persona no se traslada de empresa: arrastraria su historial
--      (jornadas, sesiones, tareas) a la otra. Si cambia de empleador se le
--      crea una cuenta nueva con otro correo.
CREATE OR REPLACE FUNCTION fn_usuario_no_cambia_organizacion() RETURNS trigger AS $$
BEGIN
  IF OLD."organizacionId" IS NOT NULL
     AND NEW."organizacionId" IS DISTINCT FROM OLD."organizacionId" THEN
    RAISE EXCEPTION 'Un usuario no puede cambiar de organizacion (%).', OLD.email;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_usuario_no_cambia_organizacion ON usuarios;
CREATE TRIGGER tg_usuario_no_cambia_organizacion
  BEFORE UPDATE OF "organizacionId" ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_usuario_no_cambia_organizacion();

-- 10.4 Toda persona ligada a un dato debe ser de la misma empresa que el dato.
--      Una sola funcion auxiliar y un disparador por relacion.
CREATE OR REPLACE FUNCTION fn_exigir_usuario_de_organizacion(
  p_usuario UUID, p_organizacion UUID, p_contexto TEXT
) RETURNS void AS $$
BEGIN
  IF p_usuario IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM usuarios
     WHERE id = p_usuario AND "organizacionId" = p_organizacion
  ) THEN
    RAISE EXCEPTION 'Aislamiento Multi-SaaS: el usuario % no pertenece a la organizacion de %.',
      p_usuario, p_contexto;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Proyectos: el propietario es de la empresa del proyecto.
CREATE OR REPLACE FUNCTION fn_tenant_proyecto() RETURNS trigger AS $$
BEGIN
  PERFORM fn_exigir_usuario_de_organizacion(NEW."propietarioId", NEW."organizacionId", 'el proyecto');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_tenant_proyecto ON proyectos;
CREATE TRIGGER tg_tenant_proyecto
  BEFORE INSERT OR UPDATE OF "propietarioId", "organizacionId" ON proyectos
  FOR EACH ROW EXECUTE FUNCTION fn_tenant_proyecto();

-- Miembros: solo personas de la empresa del proyecto integran su equipo.
CREATE OR REPLACE FUNCTION fn_tenant_miembro() RETURNS trigger AS $$
BEGIN
  PERFORM fn_exigir_usuario_de_organizacion(
    NEW."usuarioId",
    (SELECT "organizacionId" FROM proyectos WHERE id = NEW."proyectoId"),
    'el equipo del proyecto');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_tenant_miembro ON miembros_proyecto;
CREATE TRIGGER tg_tenant_miembro
  BEFORE INSERT OR UPDATE ON miembros_proyecto
  FOR EACH ROW EXECUTE FUNCTION fn_tenant_miembro();

-- Actividades: el responsable es de la empresa del proyecto.
CREATE OR REPLACE FUNCTION fn_tenant_actividad() RETURNS trigger AS $$
BEGIN
  PERFORM fn_exigir_usuario_de_organizacion(
    NEW."responsableId",
    (SELECT "organizacionId" FROM proyectos WHERE id = NEW."proyectoId"),
    'la actividad');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_tenant_actividad ON actividades;
CREATE TRIGGER tg_tenant_actividad
  BEFORE INSERT OR UPDATE OF "responsableId", "proyectoId" ON actividades
  FOR EACH ROW EXECUTE FUNCTION fn_tenant_actividad();

-- Derivaciones: quien recibe la tarea es de la empresa del proyecto.
CREATE OR REPLACE FUNCTION fn_tenant_derivacion() RETURNS trigger AS $$
BEGIN
  PERFORM fn_exigir_usuario_de_organizacion(
    NEW."aUsuarioId",
    (SELECT p."organizacionId" FROM actividades a JOIN proyectos p ON p.id = a."proyectoId"
      WHERE a.id = NEW."actividadId"),
    'la derivacion');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_tenant_derivacion ON derivaciones;
CREATE TRIGGER tg_tenant_derivacion
  BEFORE INSERT ON derivaciones
  FOR EACH ROW EXECUTE FUNCTION fn_tenant_derivacion();

-- Jornadas: se registran en la empresa de su trabajador.
CREATE OR REPLACE FUNCTION fn_tenant_jornada() RETURNS trigger AS $$
BEGIN
  PERFORM fn_exigir_usuario_de_organizacion(NEW."usuarioId", NEW."organizacionId", 'la jornada');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_tenant_jornada ON jornadas;
CREATE TRIGGER tg_tenant_jornada
  BEFORE INSERT OR UPDATE OF "usuarioId", "organizacionId" ON jornadas
  FOR EACH ROW EXECUTE FUNCTION fn_tenant_jornada();

-- Chat: emisor y receptor son de la empresa del mensaje.
CREATE OR REPLACE FUNCTION fn_tenant_mensaje() RETURNS trigger AS $$
BEGIN
  PERFORM fn_exigir_usuario_de_organizacion(NEW."emisorId", NEW."organizacionId", 'el mensaje');
  PERFORM fn_exigir_usuario_de_organizacion(NEW."receptorId", NEW."organizacionId", 'el mensaje');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_tenant_mensaje ON mensajes_chat;
CREATE TRIGGER tg_tenant_mensaje
  BEFORE INSERT OR UPDATE OF "emisorId", "receptorId", "organizacionId" ON mensajes_chat
  FOR EACH ROW EXECUTE FUNCTION fn_tenant_mensaje();
