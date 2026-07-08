# 6. Alertas por Telegram

El sistema manda un mensaje al grupo de Telegram cada vez que un NVR o cámara se cae o se recupera.

## Configuración (ya hecha, pero por si hay que rehacerla)

Se necesitan 2 valores en el `.env` (ver doc 8):
```
TELEGRAM_TOKEN=el-token-del-bot
TELEGRAM_CHAT_ID=el-id-del-grupo
```

Guía completa de cómo crear el bot y el grupo desde cero: pídele a Claude o busca "cómo crear un bot de Telegram con BotFather" — el resumen rápido es:
1. Hablarle a `@BotFather` en Telegram → `/newbot` → seguir los pasos → te da el `TELEGRAM_TOKEN`
2. Crear un grupo, agregar el bot, escribir un mensaje mencionándolo (`@nombre_del_bot hola`)
3. Correr `curl "https://api.telegram.org/bot<TOKEN>/getUpdates"` para sacar el `chat_id` del grupo

## Cómo decide entre mandar 1 mensaje por evento o un resumen

Para no inundar el grupo cuando se cae media red de un golpe:

- **10 o menos** NVRs/cámaras afectadas → un mensaje individual por cada uno, con nombre, IP, NVR (si es cámara) y fecha
- **Más de 10** NVRs o más de 10 cámaras en el mismo chequeo → un solo mensaje resumen, tipo:
  ```
  INCIDENTE MASIVO DETECTADO
  40 NVR(s) caído(s)
  1048 cámara(s) caída(s)
  Fecha: ...
  ```

Este umbral (10) está en `services/monitorService.js`, en la constante `UMBRAL_TELEGRAM_MASIVO` — se puede ajustar ahí si hace falta.

## Qué pasa si no hay internet cuando algo se cae

El servidor **no pierde** esa alerta: si falla el envío (por ejemplo, sin internet), el mensaje se guarda en una cola en memoria y se reintenta automáticamente en cada chequeo siguiente (cada 20 segundos), hasta que logre enviarse. En cuanto vuelve el internet, esos mensajes pendientes se mandan.

## Revocar y regenerar el token (si se expuso por accidente)

En Telegram, hablarle a `@BotFather`:
```
/mybots → seleccionar el bot → API Token → Revoke current token
```
Te da un token nuevo — hay que actualizarlo en el `.env` y reiniciar el servidor.