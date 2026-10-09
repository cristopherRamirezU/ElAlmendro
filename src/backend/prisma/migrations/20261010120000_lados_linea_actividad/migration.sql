-- Bordes que alguien fijo a mano para la linea que llega a cada tarea (desde
-- su padre o desde el nodo principal), por orientacion. Nulo = automatico.
ALTER TABLE "actividades" ADD COLUMN IF NOT EXISTS "ladosLinea" JSONB;
