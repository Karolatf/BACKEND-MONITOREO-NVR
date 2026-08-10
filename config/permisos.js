// ── Catálogo de permisos granulares ───────────────────────────────────────────
// Única fuente de verdad de qué permisos existen en el sistema. Se usa para:
//  - Validar/limpiar lo que llega desde la web al crear o editar un usuario
//    (nunca se guarda un permiso que no esté en esta lista)
//  - Poblar el formulario de "Gestión de usuarios" en el frontend
//
// El Súper Administrador SIEMPRE tiene acceso total — no depende de esta lista.
// "analista" y "visualizacion" arrancan sin ningún permiso (0 accesos extra,
// solo ven el dashboard) y el súper admin se los va otorgando uno por uno.
//
// Para agregar un permiso nuevo en el futuro (ej. cuando se construya el
// punto 4 o el punto 6 del roadmap): agregar una línea aquí, y listo — ya
// queda disponible para asignar desde la web y validado en el backend.
// ─────────────────────────────────────────────────────────────────────────────

export const PERMISOS_DISPONIBLES = [
  {
    clave: 'gestionar_dispositivos',
    nombre: 'Gestionar dispositivos',
    descripcion: 'Agregar, editar y eliminar NVRs y cámaras desde la web'
  },
  {
    clave: 'gestionar_configuracion',
    nombre: 'Gestionar configuración',
    descripcion: 'Ajustar horario laboral, umbrales de alerta y sensibilidad del monitoreo'
  },
  {
    clave: 'exportar_reportes',
    nombre: 'Exportar reportes',
    descripcion: 'Descargar el historial de eventos en Excel y PDF'
  }
];

export const CLAVES_PERMISOS_VALIDAS = PERMISOS_DISPONIBLES.map(p => p.clave);

// Roles que se pueden asignar a otros usuarios desde la web. "superadmin"
// NO está en esta lista a propósito: es único, se crea solo por consola
// (scripts/crearAdmin.js) y nunca se otorga ni se edita desde la interfaz.
export const ROLES_ASIGNABLES = ['analista', 'visualizacion'];