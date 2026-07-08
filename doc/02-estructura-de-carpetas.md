# 2. Estructura de carpetas del Backend

```
BACKEND/
├── config/
│   └── dispositivos.js        ← Lista de todos los NVRs y cámaras (ver doc 3)
├── controllers/
│   ├── apiController.js       ← Responde las peticiones de /api/status y /api/historial
│   └── authController.js      ← Responde el login y el refresco de sesión
├── db/
│   ├── conexion.js            ← Crea la conexión a MySQL
│   ├── init.js                ← Se ejecuta al arrancar, conecta a la BD
│   ├── root.sql                ← Crear la base de datos y el usuario (una sola vez)
│   ├── schema.sql              ← Crear la tabla de eventos (una sola vez)
│   └── schema_auth.sql         ← Crear la tabla de usuarios/login (una sola vez)
├── middleware/
│   ├── authMiddleware.js      ← Revisa que el token de sesión sea válido
│   └── rateLimitLogin.js      ← Bloquea el login tras muchos intentos fallidos
├── routes/
│   ├── api.routes.js          ← Define las URLs /api/status y /api/historial
│   └── auth.routes.js         ← Define las URLs /api/auth/login y /api/auth/refresh
├── scripts/
│   └── crearAdmin.js          ← Script para crear usuarios administradores
├── services/
│   ├── authService.js         ← Lógica de login, contraseñas, tokens
│   ├── monitorService.js      ← El corazón: revisa NVRs/cámaras cada 20s
│   ├── socketService.js       ← Guarda la conexión de Socket.IO para usarla en otros archivos
│   └── telegramService.js     ← Envía los mensajes a Telegram
├── docs/                      ← Esta carpeta
├── .env                       ← Contraseñas y configuración (NO se sube a Git)
├── package.json                ← Lista de librerías que usa el proyecto
└── server.js                   ← El archivo que arranca todo
```

## La regla simple para saber dónde mirar

- ¿Quieres agregar/quitar un dispositivo? → `config/dispositivos.js`
- ¿Algo relacionado a Telegram? → `services/telegramService.js`
- ¿Algo relacionado a quién puede entrar a la web? → `services/authService.js` y `scripts/crearAdmin.js`
- ¿La lógica de "cuándo se considera que algo cayó"? → `services/monitorService.js`
- ¿Configuración (contraseñas, tokens)? → `.env`