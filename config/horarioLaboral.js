// ── Configuración del horario laboral ─────────────────────────────────────────
// Se usa para decidir cuándo aplican las reglas de "horario no laboral": de
// noche y fines de semana, solo se alerta por Telegram si algo lleva varios
// minutos caído de forma SOSTENIDA, en vez de alertar de inmediato como en
// horario laboral. Editar aquí si el horario de trabajo cambia — no requiere
// tocar ninguna otra parte del código.
export const horarioLaboral = {
  diasLaborales: [1, 2, 3, 4, 5], // 0=domingo, 1=lunes ... 6=sábado → Lunes a Viernes
  horaInicio:    6,  // 6:00 a.m.
  minutoInicio:  0,
  horaFin:       17, // 5:30 p.m.
  minutoFin:     30,
};

// Minutos que un dispositivo debe llevar caído de forma sostenida en horario
// NO laboral antes de mandar la alerta por Telegram.
export const MINUTOS_SOSTENIDO_NO_LABORAL = 3;

// Ventana de tiempo (minutos) y cantidad de cambios de estado dentro de esa
// ventana para considerar un dispositivo "inestable" (flapping) y dejar de
// notificar cada parpadeo individual por Telegram.
export const VENTANA_FLAPPING_MINUTOS = 15;
export const CAMBIOS_FLAPPING_UMBRAL  = 4;

// % de dispositivos fallando AL MISMO TIEMPO, en un mismo chequeo, para
// sospechar que el problema es del propio equipo de monitoreo (sin red/
// internet) y no de los NVRs/cámaras reales. Si se supera, el chequeo se
// omite por completo: no se actualiza ningún estado ni se manda ninguna
// alerta falsa.
export const UMBRAL_CORDURA_PORCENTAJE = 80;