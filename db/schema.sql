-- ═══════════════════════════════════════════════════════════════════
-- PASO 1: Seleccionar la base de datos a usar
-- ═══════════════════════════════════════════════════════════════════

USE nvr_monitor; -- Apuntar todas las consultas siguientes a esta BD


-- ═══════════════════════════════════════════════════════════════════
-- PASO 2: Crear la tabla de eventos
-- Guarda cada caída y recuperación de NVRs y cámaras
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS eventos (
  id               INT AUTO_INCREMENT PRIMARY KEY,       -- ID único autoincremental
  nombre           VARCHAR(100)                 NOT NULL, -- Nombre del NVR o cámara
  ip               VARCHAR(50)                  NOT NULL, -- Dirección IP del dispositivo
  tipo             ENUM('caida','recuperacion') NOT NULL, -- Tipo de evento registrado
  tipo_dispositivo ENUM('nvr','camara')         NOT NULL, -- Si es NVR o cámara
  nvr_nombre       VARCHAR(100)                 NULL,     -- NVR al que pertenece (solo cámaras)
  fecha            DATETIME DEFAULT CURRENT_TIMESTAMP    -- Fecha y hora del evento (automática)
);