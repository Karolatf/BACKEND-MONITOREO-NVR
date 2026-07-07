// ── Servicio de alertas por Telegram ─────────────────────────────────────────
// Envía mensajes al bot de Telegram cuando ocurre una caída o recuperación.
//
// Para activar:
//   1. Busca @BotFather en Telegram y escribe /newbot
//   2. Sigue los pasos y copia el TOKEN que te entrega
//   3. Crea un grupo, agrega el bot y obtén el CHAT_ID
//   4. Pega ambos valores en tu archivo .env:
//        TELEGRAM_TOKEN=123456789:ABC-tu-token
//        TELEGRAM_CHAT_ID=-100123456789
//
// Cola de reintentos: si en el momento de una caída no hay internet (el
// servidor no puede llegar a api.telegram.org, aunque los NVRs de la red
// local sí se detecten bien), el mensaje NO se pierde: se guarda en memoria
// y se reintenta automáticamente en el siguiente chequeo, hasta que logre
// enviarse. Así, cuando vuelve el internet, también llegan las alertas de
// las caídas que pasaron mientras estuvo desconectado (no solo las de
// recuperación, que antes eran las únicas que sobrevivían).
// ─────────────────────────────────────────────────────────────────────────────

const colaPendiente = []; // Mensajes que fallaron y esperan su próximo reintento
const RETRASO_ENTRE_ENVIOS_MS = 350; // Evita ráfagas que Telegram podría limitar

// ── Envío real a la API de Telegram (lanza error si falla) ───────────────────
async function enviarMensajeTelegram(mensaje) {
  const token  = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Si no están configurados, solo mostrar en consola (modo desarrollo).
  // No se considera un error real, así que no se encola para reintento.
  if (!token || !chatId) {
    console.log(`[Telegram pendiente] ${mensaje.replace(/\n/g, ' | ')}`);
    return;
  }

  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text: mensaje })
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.description || `HTTP ${res.status}`);
  }
}

// ── Enviar una alerta (usada por monitorService en cada caída/recuperación) ──
export async function enviarAlerta(mensaje) {
  try {
    await enviarMensajeTelegram(mensaje);
  } catch (err) {
    console.error('No se pudo enviar a Telegram, se reintentará en el próximo chequeo:', err.message);
    colaPendiente.push(mensaje);
  }
}

// ── Reintentar mensajes pendientes ────────────────────────────────────────────
// Se llama al inicio de cada chequeo (ver monitorService.chequearTodo). Si
// Telegram estuvo caído (por ejemplo, sin internet), los mensajes que
// fallaron se reintentan aquí, en orden, sin perderlos.
export async function reintentarPendientes() {
  if (colaPendiente.length === 0) return;

  const pendientes = colaPendiente.splice(0, colaPendiente.length); // Vaciar la cola actual
  console.log(`Reintentando ${pendientes.length} mensaje(s) pendiente(s) de Telegram...`);

  for (const mensaje of pendientes) {
    try {
      await enviarMensajeTelegram(mensaje);
      await new Promise(resolve => setTimeout(resolve, RETRASO_ENTRE_ENVIOS_MS));
    } catch (err) {
      console.error('Sigue fallando el envío a Telegram, se reintentará después:', err.message);
      colaPendiente.push(mensaje); // Vuelve a la cola para el próximo chequeo
    }
  }
}