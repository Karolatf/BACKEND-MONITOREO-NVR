# 1. Qué es este proyecto

## En una frase
Un sistema que revisa cada 20 segundos si los NVRs y las cámaras del hospital están respondiendo en la red, muestra ese estado en una página web (pensada para una TV en la sala de monitoreo), guarda un historial de caídas/recuperaciones, y avisa por Telegram cuando algo se cae o se recupera.

## Las 2 partes del proyecto

| Carpeta | Qué es | Dónde corre |
|---|---|---|
| `BACKEND` | El "motor": revisa los dispositivos, guarda datos, manda alertas | Un PC/servidor dentro de la red del hospital, 24/7 |
| `FRONTEND` | La página web que se ve en la TV/PC/celular | El navegador de quien la mire (no corre nada por sí solo, el BACKEND se la sirve) |

**Importante:** el FRONTEND no se "ejecuta" por separado. El BACKEND, cuando arranca, sirve automáticamente los archivos del FRONTEND. Solo hay que correr el backend (`npm run dev` o el servicio) y todo funciona junto.

## Tecnologías usadas

- **Node.js + Express**: el servidor
- **MySQL**: guarda el historial de eventos y los usuarios
- **Socket.IO**: para que la web se actualice sola, en tiempo real, sin recargar
- **JWT + bcrypt**: para el login (nadie entra sin usuario/contraseña válidos)
- **Telegram Bot API**: para las alertas al celular

## Por qué NO puede vivir en la nube (Render, Railway, etc.)

El backend necesita hacerle ping a IPs como `172.30.162.246` — son direcciones **privadas**, que solo existen dentro de la red interna del hospital. Ningún servicio en internet puede alcanzarlas. Por eso el servidor tiene que correr **físicamente dentro de la red del hospital**, en un PC o servidor que esté siempre conectado a esa misma red.