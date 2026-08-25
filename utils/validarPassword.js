// ── Validación de fortaleza de contraseña (servidor) ──────────────────────────
// Refleja exactamente las mismas reglas que se muestran en el frontend
// (password.js) — se valida también aquí porque una validación que solo
// existe en el navegador se puede saltar fácilmente.
export function validarFortalezaPassword(password) {
  if (!password || password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'La contraseña debe tener al menos una letra mayúscula.';
  }
  if (!/[a-z]/.test(password)) {
    return 'La contraseña debe tener al menos una letra minúscula.';
  }
  if (!/[0-9]/.test(password)) {
    return 'La contraseña debe tener al menos un número.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'La contraseña debe tener al menos un carácter especial (ej: ! @ # $ %).';
  }
  return null; // null = válida
}