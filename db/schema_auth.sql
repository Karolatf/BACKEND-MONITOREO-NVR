-- ═══════════════════════════════════════════════════════════════════
-- EJECUTAR COMO app_user (conexión nvr_monitor en Workbench)
-- Crea la tabla de usuarios administradores para el login del dashboard
-- ═══════════════════════════════════════════════════════════════════

-- Paso 1: Seleccionar la base de datos
USE nvr_monitor;

-- ═══════════════════════════════════════════════════════════════════
-- TABLA: usuarios
-- Administradores del área de redes que pueden ingresar al monitor.
-- La contraseña NUNCA se guarda en texto plano: solo se guarda el hash
-- bcrypt generado por el script scripts/crearAdmin.js
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS usuarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,       -- Usuario de acceso (ej: gerson.paez)
  password_hash VARCHAR(255) NOT NULL,              -- Hash bcrypt de la contraseña
  nombre        VARCHAR(100) NOT NULL,               -- Nombre completo para mostrar en el header
  rol           VARCHAR(20)  NOT NULL DEFAULT 'admin', -- Reservado para roles futuros
  activo        TINYINT(1)   NOT NULL DEFAULT 1,     -- Permite desactivar un usuario sin borrarlo
  creado        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  ultimo_login  DATETIME     NULL
);