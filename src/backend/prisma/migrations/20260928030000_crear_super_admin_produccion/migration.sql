-- Multi-SaaS: crear cuenta inicial de Super Administrador SaaS
INSERT INTO "usuarios" (
    "id",
    "email",
    "hashContrasena",
    "nombreCompleto",
    "rol",
    "zonaHoraria",
    "activo",
    "creadoEn",
    "actualizadoEn",
    "organizacionId"
)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'superadmin@timeflow.cl',
    '$argon2id$v=19$m=65536,t=3,p=4$wJL8mhOfKArY+cFfrEVMYQ$T1xJ0E3o+y9PPwQxxHDGXvS6WdesOL62D0oBt6obDUA',
    'Super Administrador SaaS',
    'SUPER_ADMIN',
    'America/Santiago',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    NULL
)
ON CONFLICT ("email") DO UPDATE SET
    "rol" = 'SUPER_ADMIN',
    "hashContrasena" = EXCLUDED."hashContrasena",
    "activo" = true;

-- Asegurar cuenta de Administrador de organización por defecto (El Almendro)
INSERT INTO "usuarios" (
    "id",
    "email",
    "hashContrasena",
    "nombreCompleto",
    "rol",
    "zonaHoraria",
    "activo",
    "creadoEn",
    "actualizadoEn",
    "organizacionId"
)
VALUES (
    'b0000000-0000-0000-0000-000000000002',
    'admin@admin.cl',
    '$argon2id$v=19$m=65536,t=3,p=4$T1hHUn2qEV33N4glOCOu/g$ZFaXRyIADbYgITH9XM7tDN2TxPXSH9l+LAe5Yy8oShc',
    'Administrador TimeFlow',
    'ADMINISTRADOR',
    'America/Santiago',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'a0000000-0000-0000-0000-000000000001'
)
ON CONFLICT ("email") DO UPDATE SET
    "organizacionId" = COALESCE("usuarios"."organizacionId", 'a0000000-0000-0000-0000-000000000001'),
    "activo" = true;

