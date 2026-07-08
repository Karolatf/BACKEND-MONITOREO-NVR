# 3. Cómo agregar un NVR o una cámara nueva

Todo lo que el sistema monitorea vive en **un solo archivo**:

```
BACKEND/config/dispositivos.js
```

No hay que tocar ningún otro archivo ni la base de datos — al reiniciar el servidor, automáticamente monitorea lo que esté en este archivo.

## Las 4 zonas

El archivo tiene 4 listas (cada una es una "zona" que se ve como una sección distinta en la web):

```javascript
export const fisica   = [ ... ];  // Seguridad Física
export const paciente = [ ... ];  // Seguridad Paciente
export const cx       = [ ... ];  // (según corresponda)
export const ucis     = [ ... ];  // (según corresponda)
```

## Agregar una CÁMARA a un NVR que ya existe

Busca el NVR dentro de su zona, y agrega un objeto nuevo dentro de su lista `camaras`:

```javascript
{ nombre: "NVR Física 3", ip: "172.30.162.250", camaras: [
    { nombre: "1", ip: "172.30.162.132" },
    { nombre: "2", ip: "172.30.162.133" },
    { nombre: "33", ip: "172.30.162.199" },   // ← LÍNEA NUEVA (no olvides la coma antes)
] },
```

## Agregar un NVR NUEVO completo

Agrega un objeto nuevo a la lista de la zona que corresponda:

```javascript
export const fisica = [
  // ... NVRs que ya existen ...
  {
    nombre: "NVR Física 15",
    ip: "172.30.162.999",
    camaras: [
      { nombre: "1", ip: "172.30.162.201" },
      { nombre: "2", ip: "172.30.162.202" }
    ]
  }
];
```

## Reglas importantes

- Cada objeto `{ ... }` debe terminar en coma `,` si le sigue otro objeto (menos el último de la lista)
- El `nombre` es lo que se ve en pantalla — puede ser cualquier texto
- La `ip` debe ser la IP real del dispositivo en la red
- Si te equivocas en una coma o una llave `{ }`, el servidor no arranca — revisa el error en la consola, casi siempre dice la línea exacta

## Después de editar el archivo

Hay que **reiniciar el servidor** para que tome los cambios:

```cmd
taskkill /F /IM node.exe
schtasks /run /tn "NVR Monitor - Servidor"
```

(o si lo estás corriendo manual con Git Bash: `Ctrl+C` y `npm run dev` de nuevo)

## Cómo verificar que quedó bien

1. Abre `http://localhost:3000` en el navegador
2. Busca la tarjeta del NVR/cámara nueva en su zona correspondiente
3. Si no aparece o el servidor no arrancó, revisa la consola — casi siempre el error apunta a la línea exacta del archivo con el problema de sintaxis