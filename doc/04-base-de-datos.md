# 4. Base de datos

Usa **MySQL**, administrada con **MySQL Workbench**. La base de datos se llama `nvr_monitor`.

## Las 2 tablas

### `eventos`
Guarda cada caída y recuperación de cada NVR/cámara — es el historial que se ve en la web.

| Columna | Qué guarda |
|---|---|
| `id` | Número consecutivo |
| `nombre` | Nombre del dispositivo |
| `ip` | IP del dispositivo |
| `tipo` | `caida` o `recuperacion` |
| `tipo_dispositivo` | `nvr` o `camara` |
| `nvr_nombre` | Si es cámara, a qué NVR pertenece |
| `fecha` | Cuándo ocurrió |

### `usuarios`
Los administradores que pueden entrar a la web (ver doc 5).

## Si hay que recrear la base de datos desde cero

Orden de ejecución (cada uno en Workbench):

1. **`db/root.sql`** — conectado como **root**. Crea la base de datos y el usuario `app_user` con sus permisos.
2. **`db/schema.sql`** — conectado como **app_user**. Crea la tabla `eventos`.
3. **`db/schema_auth.sql`** — conectado como **app_user**. Crea la tabla `usuarios`.

Después de correr los 3, hay que crear el primer administrador (ver doc 5).

## Consultas útiles

**Ver los últimos eventos:**
```sql
SELECT * FROM eventos ORDER BY fecha DESC LIMIT 50;
```

**Ver cuántos eventos hay en total (crece con el tiempo, vale la pena revisarlo cada tanto):**
```sql
SELECT COUNT(*) FROM eventos;
```

**Ver los administradores registrados:**
```sql
SELECT id, username, nombre, rol, ultimo_login FROM usuarios;
```

## Nota sobre el crecimiento de la tabla `eventos`

Esta tabla nunca se borra sola — va a seguir creciendo mientras el sistema esté corriendo. No afecta el funcionamiento a corto/mediano plazo, pero si en el futuro se vuelve muy grande (millones de filas), valdría la pena archivar o borrar los eventos más antiguos de, por ejemplo, más de 1 año.