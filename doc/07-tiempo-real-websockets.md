# 7. Tiempo real (WebSockets / Socket.IO)

La web **no** recarga ni pregunta "¿algo cambió?" cada cierto tiempo. En vez de eso, mantiene una conexión abierta (WebSocket) con el servidor, y el servidor le avisa **al instante** cuando algo cambia.

## Cómo funciona, en resumen

1. Cada 20 segundos (configurable en `.env`), el servidor revisa todos los NVRs y cámaras
2. Si detecta un cambio (algo se cayó o se recuperó), se lo manda de inmediato a **todos los navegadores conectados** en ese momento (sin esperar a que ellos pregunten)
3. La web recibe ese mensaje y actualiza las tarjetas, el historial y muestra la notificación — todo sin recargar la página

## Seguridad de la conexión

Cada navegador que se conecta al WebSocket tiene que mandar su token de sesión (el mismo del login). Si el token no es válido o expiró, el servidor rechaza la conexión — nadie ve los datos del monitoreo sin haber iniciado sesión primero.

## Dónde vive esto en el código

- `services/socketService.js` — guarda la conexión de Socket.IO para que otros archivos la puedan usar
- `server.js` — configura el servidor de sockets y la validación del token
- `services/monitorService.js` — manda los mensajes (`estado`, `evento`) cada vez que detecta algo

## Si la web se ve "trabada" o no actualiza

Esto casi siempre es un problema de conexión, no de lógica. Revisar:
1. Que el servidor esté corriendo (`http://localhost:3000` debe cargar)
2. La consola del navegador (F12 → pestaña "Console") — ahí aparecen errores de conexión si los hay
3. Si el navegador dice "Sin conexión con el servidor — reconectando..." en la esquina, es que perdió la conexión y está intentando recuperarla sola