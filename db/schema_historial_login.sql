-- Ejecutar como app_user (conexion nvr_monitor en Workbench)
-- Se ejecuta DESPUES de schema_auth.sql (necesita que la tabla `usuarios`
-- ya exista, por la llave foránea).
--
-- Registra cada inicio de sesión exitoso: quién entró, desde qué IP y
-- cuándo. Se usa en "Mi Perfil" -> "Historial de Inicios de Sesión",
-- visible únicamente para el súper administrador.

-- Paso 1: Seleccionar la base de datos
USE nvr_monitor;

-- Tabla: historial_login
-- `username` se guarda también como texto (además de `usuario_id`) porque
-- el username de una cuenta se puede editar más adelante (ver el flujo de
-- edición en Gestión de Usuarios) — así el historial conserva el nombre
-- que la persona tenía EN ESE MOMENTO, igual que `nvr_nombre` en la tabla
-- `eventos` conserva el nombre del NVR en el momento del evento.
CREATE TABLE IF NOT EXISTS historial_login (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT          NOT NULL,
  username   VARCHAR(50)  NOT NULL,
  ip         VARCHAR(50)  NOT NULL,
  fecha      DATETIME     DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_historial_login_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Indice: acelera el ORDER BY fecha DESC que usa la tarjeta de Mi Perfil
CREATE INDEX idx_historial_login_fecha ON historial_login (fecha);