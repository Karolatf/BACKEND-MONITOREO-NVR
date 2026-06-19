// ── Configuración centralizada de dispositivos de red ────────────────────────
// Aquí se definen todos los NVRs del sistema agrupados por zona.
// Para agregar cámaras a un NVR, añade objetos al array camaras:
//   { nombre: "Cam prueba", ip: "172.30.164.82" }
// ─────────────────────────────────────────────────────────────────────────────

// ── NVRs de Seguridad Física ──────────────────────────────────────────────────
export const fisica = [
  { nombre: "NVR Física 1",  ip: "172.30.162.246", camaras: [{ nombre: "Cam Sala de espera Cirugía", ip: "172.30.162.203" }] },
  { nombre: "NVR Física 2",  ip: "172.30.162.249", camaras: [{ nombre: "Cam prueba", ip: "172.30.164.82" }] },
  { nombre: "NVR Física 3",  ip: "172.30.162.250", camaras: [] },
  { nombre: "NVR Física 4",  ip: "172.30.162.251", camaras: [] },
  { nombre: "NVR Física 5",  ip: "172.30.162.252", camaras: [] },
  { nombre: "NVR Física 6",  ip: "172.30.162.253", camaras: [] },
  { nombre: "NVR Física 7",  ip: "172.30.162.254", camaras: [] },
  { nombre: "NVR Física 8",  ip: "172.30.162.247", camaras: [] },
  { nombre: "NVR Física 9",  ip: "172.30.162.239", camaras: [] },
  { nombre: "NVR Física 10", ip: "172.30.162.255", camaras: [] },
  { nombre: "NVR Física 11", ip: "172.30.162.245", camaras: [] },
  { nombre: "NVR Física 12", ip: "172.30.163.254", camaras: [] }
];

// ── NVRs de Seguridad del Paciente ────────────────────────────────────────────
export const paciente = [
  { nombre: "NVR Paciente 1",  ip: "172.30.165.236", camaras: [] },
  { nombre: "NVR Paciente 2",  ip: "172.30.165.239", camaras: [] },
  { nombre: "NVR Paciente 3",  ip: "172.30.166.250", camaras: [] },
  { nombre: "NVR Paciente 4",  ip: "172.30.166.249", camaras: [] },
  { nombre: "NVR Paciente 5",  ip: "172.30.165.233", camaras: [] },
  { nombre: "NVR Paciente 6",  ip: "172.30.165.237", camaras: [] },
  { nombre: "NVR Paciente 7",  ip: "172.30.165.244", camaras: [] },
  { nombre: "NVR Paciente 8",  ip: "172.30.165.240", camaras: [] },
  { nombre: "NVR Paciente 9",  ip: "172.30.165.241", camaras: [] },
  { nombre: "NVR Paciente 10", ip: "172.30.165.234", camaras: [] },
  { nombre: "NVR Paciente 11", ip: "172.30.165.235", camaras: [] },
  { nombre: "NVR Paciente 12", ip: "172.30.165.238", camaras: [] },
  { nombre: "NVR Paciente 13", ip: "172.30.165.243", camaras: [] },
  { nombre: "NVR Paciente 14", ip: "172.30.165.242", camaras: [] },
  { nombre: "NVR Paciente 15", ip: "172.30.165.245", camaras: [] },
  { nombre: "NVR Paciente 16", ip: "172.30.165.232", camaras: [] }
];

// ── NVRs de Cirugía (CX) ──────────────────────────────────────────────────────
export const cx = [
  { nombre: "NVR CX 1", ip: "172.30.166.251", camaras: [] },
  { nombre: "NVR CX 2", ip: "172.30.166.252", camaras: [] },
  { nombre: "NVR CX 3", ip: "172.30.166.253", camaras: [] },
  { nombre: "NVR CX 4", ip: "172.30.166.254", camaras: [] },
  { nombre: "NVR CX 5", ip: "172.30.166.248", camaras: [] }
];

// ── NVRs de UCIS ──────────────────────────────────────────────────────────────
export const ucis = [
  { nombre: "UCIS 1 / Quemados", ip: "172.30.164.240", camaras: [] },
  { nombre: "UCIS 2",            ip: "172.30.164.241", camaras: [] }
];