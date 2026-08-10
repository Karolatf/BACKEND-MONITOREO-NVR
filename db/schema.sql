-- Ejecutar como app_user (conexion nvr_monitor en Workbench)
-- Crea la tabla de eventos e indices para busquedas rapidas

-- Paso 1: Seleccionar la base de datos
USE nvr_monitor;

-- Tabla: eventos
-- Registra cada caida y recuperacion de NVRs y camaras
CREATE TABLE IF NOT EXISTS eventos (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  nombre           VARCHAR(100)                 NOT NULL,
  ip               VARCHAR(50)                  NOT NULL,
  tipo             ENUM('caida','recuperacion') NOT NULL,
  tipo_dispositivo ENUM('nvr','camara')         NOT NULL,
  nvr_nombre       VARCHAR(100)                 NULL,
  fecha            DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indices: aceleran los filtros del historial
CREATE INDEX idx_fecha      ON eventos (fecha);
CREATE INDEX idx_ip         ON eventos (ip);
CREATE INDEX idx_nombre     ON eventos (nombre);
CREATE INDEX idx_tipo_fecha ON eventos (tipo, fecha);