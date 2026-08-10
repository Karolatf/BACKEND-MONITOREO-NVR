-- Ejecutar como ROOT en MySQL Workbench

-- Paso 1: Crear la base de datos
CREATE DATABASE IF NOT EXISTS nvr_monitor;

-- Paso 2: Crear el usuario de la aplicacion
-- Cambia 'Admin123' por la contraseña que prefieras usar
CREATE USER IF NOT EXISTS 'app_user'@'localhost'
  IDENTIFIED BY 'Admin123';

-- Paso 3: Asignar permisos al usuario sobre la base de datos
GRANT ALL PRIVILEGES ON nvr_monitor.* TO 'app_user'@'localhost';

-- Paso 4: Aplicar los cambios de permisos inmediatamente
FLUSH PRIVILEGES;

-- Si app_user ya existe de un intento anterior, agrega después: 
ALTER USER 'app_user'@'localhost' IDENTIFIED BY 'Admin123';
FLUSH PRIVILEGES;