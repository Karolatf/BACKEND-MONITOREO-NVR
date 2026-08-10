// ── Middleware de autorización (rol y permisos granulares) ───────────────────
// Se usa DESPUÉS de requiereAuth, que ya dejó el token decodificado en
// req.usuario ({ id, username, rol, permisos }).
// ─────────────────────────────────────────────────────────────────────────────

// ── Exclusivo del súper administrador ─────────────────────────────────────────
// Gestión de usuarios y todo lo que jamás debe depender de un permiso
// otorgable: aquí no importa qué haya en `permisos`, solo el rol.
export function requiereSuperAdmin(req, res, next) {
  if (req.usuario?.rol !== 'superadmin') {
    return res.status(403).json({ error: 'Esta acción requiere permisos de súper administrador.' });
  }
  next();
}

// ── Requiere un permiso puntual (o ser súper admin, que siempre puede todo) ──
export function requierePermiso(clave) {
  return (req, res, next) => {
    const { rol, permisos } = req.usuario || {};
    if (rol === 'superadmin') return next();
    if (Array.isArray(permisos) && permisos.includes(clave)) return next();
    return res.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
  };
}