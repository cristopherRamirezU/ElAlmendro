-- Notificaciones en tiempo real por usuario y organizacion (Trello #43).
CREATE TABLE "notificaciones" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "organizacionId" UUID,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "enlace" TEXT,
    "entidadId" TEXT,
    "leidaEn" TIMESTAMPTZ(3),
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notificaciones_usuarioId_leidaEn_creadoEn_idx" ON "notificaciones"("usuarioId", "leidaEn", "creadoEn");
CREATE INDEX "notificaciones_organizacionId_creadoEn_idx" ON "notificaciones"("organizacionId", "creadoEn");

ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_organizacionId_fkey"
    FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
