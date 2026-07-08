# 10. Solución de problemas comunes

## "No me deja entrar, dice usuario o contraseña incorrectos"

1. Revisa que Bloq Mayús no esté activado
2. Prueba escribiéndola de nuevo directo, sin copiar/pegar (a veces se cuela un espacio o salto de línea invisible)
3. Si sigue fallando, lo más confiable es recrear el usuario:
   ```sql
   DELETE FROM usuarios WHERE username = 'el_usuario';
   ```
   y volver a correr `npm run crear-admin`

## "Dice: Demasiados intentos fallidos, espera 10 minutos"

Es el bloqueo anti-fuerza-bruta (ver doc 5). Para limpiarlo al instante sin esperar:
```cmd
taskkill /F /IM node.exe
schtasks /run /tn "NVR Monitor - Servidor"
```
(el contador de intentos vive en memoria, reiniciar el proceso lo borra)

## "El dashboard no carga / no responde"

1. Verificar que el proceso de Node esté corriendo: Administrador de tareas (`Ctrl+Shift+Esc`) → pestaña "Detalles" → buscar `node.exe`
2. Si no aparece, levantarlo: `schtasks /run /tn "NVR Monitor - Servidor"`
3. Revisar la consola/logs por errores de conexión a la base de datos

## "Las alertas de Telegram no llegan"

1. Confirmar que `TELEGRAM_TOKEN` y `TELEGRAM_CHAT_ID` estén bien puestos en el `.env`
2. Probar manualmente:
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" -d "chat_id=<CHAT_ID>" -d "text=prueba"
   ```
3. Si el problema fue que no había internet en el momento de la caída, no hay que hacer nada — el sistema reintenta solo (ver doc 6)

## "Agregué un NVR/cámara nueva y no aparece"

1. Revisar que el archivo `config/dispositivos.js` no tenga errores de sintaxis (comas, llaves) — si el servidor no arrancó, la consola dice el error
2. Confirmar que se reinició el servidor después de editar el archivo

## "El servidor se detuvo y no sé por qué"

1. Revisar si el PC se suspendió (no es lo mismo que bloqueo de pantalla — ver más abajo)
2. Revisar el Administrador de tareas si `node.exe` sigue en la lista
3. Volver a levantarlo: `schtasks /run /tn "NVR Monitor - Servidor"`

## Diferencia entre "bloqueo de pantalla" y "suspensión real"

| | Bloqueo (Lock) | Suspensión (Sleep) |
|---|---|---|
| Se ve | Pantalla de login de Windows | Pantalla negra |
| ¿El servidor sigue corriendo? | ✅ Sí | ❌ No, se detiene todo |

Si el PC entra en **suspensión real**, no hay ningún ajuste de software (ni este proyecto, ni tareas programadas, ni servicios de Windows) que lo evite — hay que desactivar la suspensión en Configuración de Windows, o usar un equipo dedicado que no la tenga.

## Errores en la consola al arrancar

- `Error: connect ECONNREFUSED 127.0.0.1:3306` → MySQL no está corriendo o los datos del `.env` están mal
- `Falta JWT_SECRET` → esto ya no debería pasar (se genera solo), si aparece es que quedó código viejo
- `Cannot find module '...'` → falta correr `npm install`