-- Permisos que el administrador da a un trabajador ademas de los de su rol
-- (por ejemplo, editar el mapa o eliminar tareas). Vacio = solo los del rol.
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "permisosExtra" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
