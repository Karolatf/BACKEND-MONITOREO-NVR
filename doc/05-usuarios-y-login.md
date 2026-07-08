# 5. Usuarios y login

Solo pueden entrar a la web las personas que tengan un usuario creado en la tabla `usuarios` de la base de datos. Las contraseñas nunca se guardan en texto plano — se guardan "hasheadas" (encriptadas de forma irreversible) con bcrypt.

## Crear un administrador nuevo (ej: un analista nuevo del equipo)

En Git Bash, dentro de `BACKEND`:

```bash
npm run crear-admin
```

Te va a pedir:
1. **Usuario** (ej: `juan.perez`) — lo que va a escribir esa persona para entrar
2. **Nombre completo** — se muestra en el header del dashboard
3. **Contraseña** (mínimo 8 caracteres) — se muestra en pantalla mientras la escribes, y también al final para que la verifiques. Asegúrate de que nadie más esté mirando la pantalla en ese momento.
4. **Confirmar contraseña**

Al final, esa persona ya puede entrar a `http://<ip-del-servidor>:3000/login.html` con esos datos.

## Borrar o desactivar un usuario (ej: alguien que ya no trabaja ahí)

En MySQL Workbench, conectado como `app_user`:

```sql
-- Borrarlo por completo:
DELETE FROM usuarios WHERE username = 'juan.perez';

-- O, si prefieres solo desactivarlo sin borrar el historial de quién lo creó:
UPDATE usuarios SET activo = 0 WHERE username = 'juan.perez';
```

## Si alguien olvidó su contraseña

Hoy no existe un botón de "olvidé mi contraseña" en la web — hay que recrearla manualmente:

```sql
DELETE FROM usuarios WHERE username = 'el_usuario';
```
Y luego correr `npm run crear-admin` de nuevo con ese mismo usuario.

## Cómo funciona la sesión (para entender comportamientos raros)

- Al iniciar sesión, se genera un token que dura **20 minutos** (configurable en `.env`, ver doc 8)
- Mientras la persona sigue usando la página activamente, el token se renueva solo cada 5 minutos, así que no lo saca a media jornada
- Si pasan **15 minutos sin mover el mouse ni hacer clic**, la sesión se cierra automáticamente y hay que volver a loguearse
- Si se **cierra la pestaña o el navegador**, hay que volver a loguearse al abrir de nuevo (la sesión no se guarda de forma permanente en el navegador)
- Si se **reinicia el servidor** (Git Bash cerrado, PC reiniciado, `npm run dev` vuelto a correr), **todas las sesiones activas se cierran** — es intencional, por seguridad, ya que la clave de firma de las sesiones se genera nueva en cada arranque

## Bloqueo por intentos fallidos

Después de **5 intentos fallidos** de login (usuario+IP), el sistema bloquea ese intento por **10 minutos**, así la contraseña sea correcta en el intento 6. Esto es para evitar ataques de fuerza bruta. Si alguien queda bloqueado por error, reiniciar el servidor limpia el bloqueo al instante (el contador vive en memoria, no en la base de datos).