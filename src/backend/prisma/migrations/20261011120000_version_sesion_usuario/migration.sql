-- Version de sesion por usuario: subirla invalida todos sus tokens previos.
ALTER TABLE "usuarios" ADD COLUMN "versionSesion" INTEGER NOT NULL DEFAULT 0;
