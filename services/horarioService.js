// ── Servicio de horario laboral ────────────────────────────────────────────────
import { horarioLaboral } from '../config/horarioLaboral.js';

// ── ¿La fecha dada cae en horario laboral? ────────────────────────────────────
// Por defecto evalúa el momento actual. Recibe una fecha opcional para poder
// probar la función con fechas específicas.
export function esHorarioLaboral(fecha = new Date()) {
  const dia = fecha.getDay();
  if (!horarioLaboral.diasLaborales.includes(dia)) return false;

  const minutosActuales = fecha.getHours() * 60 + fecha.getMinutes();
  const minutosInicio   = horarioLaboral.horaInicio * 60 + horarioLaboral.minutoInicio;
  const minutosFin      = horarioLaboral.horaFin    * 60 + horarioLaboral.minutoFin;

  return minutosActuales >= minutosInicio && minutosActuales < minutosFin;
}