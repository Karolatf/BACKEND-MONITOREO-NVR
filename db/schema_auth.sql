-- Ejecutar como app_user (conexion nvr_monitor en Workbench)
-- Crea la tabla de usuarios del dashboard: login, roles y permisos
-- granulares, y recuperación de contraseña por correo.

-- Paso 1: Seleccionar la base de datos
USE nvr_monitor;

-- Tabla: usuarios
-- rol: 'superadmin' (único, se crea solo por scripts/crearAdmin.js) |
--      'analista' | 'visualizacion' (ambos asignables desde la web,
--      permisos configurables uno por uno en la columna `permisos`)
--
-- La contraseña NUNCA se guarda en texto plano: solo se guarda el hash
-- bcrypt generado por el script scripts/crearAdmin.js o por el backend.
CREATE TABLE IF NOT EXISTS usuarios (
  id                        INT AUTO_INCREMENT PRIMARY KEY,
  username                  VARCHAR(50)  NOT NULL UNIQUE,
  password_hash             VARCHAR(255) NOT NULL,
  nombre                    VARCHAR(100) NOT NULL,
  email_personal            VARCHAR(150) NULL,
  rol                       VARCHAR(20)  NOT NULL DEFAULT 'analista',
  permisos                  JSON         NULL,
  activo                    TINYINT(1)   NOT NULL DEFAULT 1,
  creado                    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  ultimo_login              DATETIME     NULL,
  recuperacion_codigo_hash  VARCHAR(255) NULL,
  recuperacion_expira       DATETIME     NULL
);