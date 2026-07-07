// ── Acceso global a la instancia de Socket.IO ─────────────────────────────────
// Patrón singleton: server.js crea el servidor de sockets una sola vez y lo
// guarda aquí. Otros módulos (como monitorService) lo consultan con getIO()
// para emitir eventos en tiempo real sin tener que pasarlo por parámetros.
// ─────────────────────────────────────────────────────────────────────────────

let io = null;

export function setIO(instancia) {
  io = instancia;
}

export function getIO() {
  return io;
}