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
// ─────────────────────────────────────────────────────────────────────────────

export async function enviarAlerta(mensaje) {
  const token  = process.env.TELEGRAM_TOKEN;   // Token del bot desde el archivo .env
  const chatId = process.env.TELEGRAM_CHAT_ID; // ID del chat o grupo de destino desde .env

  // Si no están configurados, solo mostrar en consola (modo desarrollo)
  if (!token || !chatId) {
    console.log(`[Telegram pendiente] ${mensaje.replace(/\n/g, ' | ')}`); // Log temporal
    return; // Salir sin intentar enviar
  }

  try {
    // Enviar mensaje a través de la API de Telegram
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`, // Endpoint de la API
      {
        method:  'POST',                                   // Método HTTP POST
        headers: { 'Content-Type': 'application/json' },  // Cabecera de tipo JSON
        body:    JSON.stringify({ chat_id: chatId, text: mensaje }) // Cuerpo del mensaje
      }
    );

    if (!res.ok) {                                         // Si la respuesta no fue exitosa
      const data = await res.json();                       // Parsear la respuesta de error
      console.error('Error de Telegram:', data.description); // Mostrar descripción del error
    }
  } catch (err) {
    console.error('Error al enviar alerta de Telegram:', err.message); // Error de red
  }
}