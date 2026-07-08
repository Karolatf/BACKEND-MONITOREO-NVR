# 8. Variables de entorno (.env)

El archivo `.env` (en la raíz de `BACKEND`) guarda toda la configuración sensible: contraseñas, tokens, tiempos. **Nunca se sube a Git** — cada máquina donde corra el proyecto necesita su propio `.env`.

## Variables actuales

| Variable | Qué es | Ejemplo |
|---|---|---|
| `DB_HOST` | Dónde está la base de datos MySQL | `localhost` |
| `DB_USER` | Usuario de MySQL para la app | `app_user` |
| `DB_PASS` | Contraseña de ese usuario | (la que se definió al crearlo) |
| `DB_NAME` | Nombre de la base de datos | `nvr_monitor` |
| `PORT` | Puerto donde corre el servidor web | `3000` |
| `INTERVALO_SEGUNDOS` | Cada cuánto revisa los NVRs/cámaras | `20` |
| `TELEGRAM_TOKEN` | Token del bot de Telegram (ver doc 6) | `123456:ABC...` |
| `TELEGRAM_CHAT_ID` | ID del grupo que recibe las alertas | `-100123456789` |
| `JWT_EXPIRES_IN` | Cuánto dura una sesión de login | `20m` |

## Notas importantes

- **`JWT_SECRET` ya NO se configura aquí** — el servidor genera una clave aleatoria distinta cada vez que arranca, a propósito, para que reiniciar el proceso cierre todas las sesiones activas (ver doc 5).
- Si `TELEGRAM_TOKEN` o `TELEGRAM_CHAT_ID` quedan vacíos, el sistema sigue funcionando normal — simplemente no manda nada a Telegram, y en su lugar imprime el mensaje en la consola (útil para pruebas).
- Después de cambiar cualquier valor del `.env`, hay que **reiniciar el servidor** para que tome el cambio (no se recarga solo).

## Archivo de ejemplo

En `.env.example` hay una plantilla sin valores reales, para saber qué variables existen sin exponer contraseñas — útil si hay que configurar el proyecto en otra máquina desde cero.