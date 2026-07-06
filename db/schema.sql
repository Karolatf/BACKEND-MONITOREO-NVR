-- ═══════════════════════════════════════════════════════════════════
-- EJECUTAR COMO app_user (conexión nvr_monitor en Workbench)
-- Crea la tabla de eventos e índices para búsquedas rápidas
-- ═══════════════════════════════════════════════════════════════════

-- Paso 1: Seleccionar la base de datos
USE nvr_monitor;

-- ═══════════════════════════════════════════════════════════════════
-- TABLA: eventos
-- Registra cada caída y recuperación de NVRs y cámaras
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eventos (
  id               INT AUTO_INCREMENT PRIMARY KEY,       -- ID único autoincremental
  nombre           VARCHAR(100)                 NOT NULL, -- Nombre del NVR o cámara
  ip               VARCHAR(50)                  NOT NULL, -- Dirección IP del dispositivo
  tipo             ENUM('caida','recuperacion') NOT NULL, -- Tipo de evento registrado
  tipo_dispositivo ENUM('nvr','camara')         NOT NULL, -- Si es NVR o cámara
  nvr_nombre       VARCHAR(100)                 NULL,     -- NVR al que pertenece (solo cámaras)
  fecha            DATETIME DEFAULT CURRENT_TIMESTAMP    -- Fecha y hora automática del evento
);

-- ═══════════════════════════════════════════════════════════════════
-- ÍNDICES — aceleran los filtros del historial
-- ═══════════════════════════════════════════════════════════════════

-- Búsquedas por rango de fecha y hora
CREATE INDEX idx_fecha      ON eventos (fecha);

-- Búsquedas por IP del dispositivo
CREATE INDEX idx_ip         ON eventos (ip);

-- Búsquedas por nombre del NVR o cámara
CREATE INDEX idx_nombre     ON eventos (nombre);

-- Filtrar por tipo de evento y fecha al mismo tiempo
CREATE INDEX idx_tipo_fecha ON eventos (tipo, fecha);