-- ═══════════════════════════════════════════════════════════════════
-- PASO 1: Crear la base de datos
-- ═══════════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS nvr_monitor; -- Crear BD solo si no existe


-- ═══════════════════════════════════════════════════════════════════
-- PASO 2: Crear el usuario de la aplicación
-- Cambia 'AppUser1234' por la contraseña que prefieras
-- ═══════════════════════════════════════════════════════════════════

CREATE USER IF NOT EXISTS 'app_user'@'localhost'  -- Usuario solo para conexiones locales
  IDENTIFIED BY 'AppUser1234';                    -- Contraseña del usuario


-- ═══════════════════════════════════════════════════════════════════
-- PASO 3: Asignar permisos al usuario sobre la base de datos
-- ═══════════════════════════════════════════════════════════════════

GRANT ALL PRIVILEGES ON nvr_monitor.* TO 'app_user'@'localhost'; -- Permisos completos sobre nvr_monitor


-- ═══════════════════════════════════════════════════════════════════
-- PASO 4: Aplicar los cambios de permisos inmediatamente
-- ═══════════════════════════════════════════════════════════════════

FLUSH PRIVILEGES; -- Recargar la tabla de permisos de MySQL