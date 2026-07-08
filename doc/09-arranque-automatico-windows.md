# 9. Arranque automático en Windows

## Problema que resuelve

Antes, el servidor solo corría mientras hubiera una ventana de Git Bash abierta ejecutando `npm run dev`. Si se cerraba esa ventana (a propósito o por accidente), el monitoreo se detenía por completo hasta volver a ejecutarlo manualmente.

Esta configuración crea una **Tarea Programada de Windows** que arranca el servidor automáticamente al iniciar sesión, sin depender de ninguna terminal abierta ni de que alguien lo ejecute a mano.

> **Importante:** esto resuelve el problema de "se cerró la ventana". **No resuelve** que el equipo entre en suspensión real (Sleep) — mientras el PC esté suspendido, nada corre en él, sea un servicio, una tarea programada, o lo que sea. Ese tema se aborda por separado (ver sección final).

---

## Requisitos previos

- Proyecto backend ubicado en una ruta conocida (en este caso `C:\PROYECTO MONITOREO NVR\BACKEND`)
- Acceso a una consola **cmd** con permisos de Administrador
- Node.js y las dependencias del proyecto ya instaladas (`npm install` ya ejecutado al menos una vez)

---

## Paso 1 — Crear el script que arranca el servidor

En la **raíz** de la carpeta `BACKEND` (al mismo nivel que `server.js` y `package.json`), crear un archivo llamado:

**`iniciar-servidor.bat`**

```bat
@echo off
cd /d "C:\PROYECTO MONITOREO NVR\BACKEND"
npm run dev
```

> Ajustar la ruta del `cd /d` si el proyecto está en otra ubicación. Para confirmar la ruta exacta, correr `pwd` en Git Bash dentro de la carpeta del proyecto y convertir el resultado a formato Windows (`/c/...` → `C:\...`).

---

## Paso 2 — Crear un lanzador invisible (sin ventana de consola)

En la misma carpeta `BACKEND`, crear:

**`iniciar-servidor-oculto.vbs`**

```vbs
Set objShell = CreateObject("WScript.Shell")
objShell.Run """C:\PROYECTO MONITOREO NVR\BACKEND\iniciar-servidor.bat""", 0, False
```

Este archivo ejecuta el `.bat` de fondo, sin mostrar ninguna ventana negra de consola.

---

## Paso 3 — Registrar la tarea programada

Abrir **cmd como Administrador** (clic derecho → "Ejecutar como administrador") y correr:

```cmd
schtasks /create /tn "NVR Monitor - Servidor" /tr "wscript.exe \"C:\PROYECTO MONITOREO NVR\BACKEND\iniciar-servidor-oculto.vbs\"" /sc onlogon /rl highest /f
```

Respuesta esperada:
```
CORRECTO: La tarea programada "NVR Monitor - Servidor" se ha creado correctamente.
```

> Si sale `Error: Acceso denegado`, es porque cmd no se abrió como Administrador. Si el equipo no permite permisos de administrador, se puede quitar el flag `/rl highest` del comando (corre con permisos normales, suficiente para este caso).

---

## Paso 4 — Probar sin reiniciar sesión

```cmd
schtasks /run /tn "NVR Monitor - Servidor"
```

Verificar que funcionó:
- Abrir el navegador en `http://localhost:3000` → debe aparecer el login del dashboard
- O abrir el Administrador de tareas (`Ctrl+Shift+Esc`) → pestaña "Detalles" → buscar `node.exe` en la lista

---

## Comandos útiles de mantenimiento

| Acción | Comando |
|---|---|
| Ver que la tarea existe | `schtasks /query /tn "NVR Monitor - Servidor"` |
| Ejecutarla manualmente | `schtasks /run /tn "NVR Monitor - Servidor"` |
| Eliminarla | `schtasks /delete /tn "NVR Monitor - Servidor" /f` |
| Detener el servidor (mata todos los procesos Node) | `taskkill /F /IM node.exe` |

---

## Resultado final

```
BACKEND/
├── config/
├── controllers/
├── db/
├── middleware/
├── routes/
├── scripts/
├── services/
├── .env
├── iniciar-servidor.bat            ← nuevo
├── iniciar-servidor-oculto.vbs     ← nuevo
├── package.json
└── server.js
```

A partir de ahora, cada vez que se inicia sesión en Windows en ese PC, el servidor arranca solo — no depende de Git Bash ni de ejecutar `npm run dev` manualmente.

---

## Pendiente: suspensión real del equipo (fuera del alcance de esta solución)

Si el PC entra en **suspensión real** (no solo bloqueo de pantalla), ninguna tarea programada, servicio de Windows, ni cambio de código lo soluciona — mientras el equipo está suspendido, literalmente nada se ejecuta en él.

Para confirmar si es bloqueo o suspensión real:
```cmd
gpresult /h resultado.html
```
Abrir el `.html` generado y buscar (Ctrl+F) "Power" o "Energía". Si no aparece ninguna política relacionada, la suspensión no está forzada por GPO y se puede desactivar en:

**Configuración → Sistema → Energía y batería → Pantalla y suspensión → "Suspender el dispositivo" → Nunca**

Si la suspensión sí está forzada y no se puede desactivar, la solución pasa por un equipo dedicado que no la tenga (mini PC, Raspberry Pi, VM, o el servidor oficial del hospital una vez el proyecto pase a producción) — no por ajustes de software adicionales.