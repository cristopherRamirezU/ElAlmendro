-- Aceptacion de los terminos de uso y la politica de privacidad por persona:
-- que version acepto y cuando. Nulo = nunca; la app se las pide al entrar.
ALTER TABLE "usuarios" ADD COLUMN "politicasVersion" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "politicasAceptadasEn" TIMESTAMPTZ(3);
