// ── Servicio de correo (recuperación de contraseña) ───────────────────────────
// Usa una cuenta de Gmail con "contraseña de aplicación" (no la contraseña
// normal de la cuenta) como remitente. El transportador se crea una sola vez
// y se reutiliza (patrón singleton), igual que el pool de MySQL.
// ─────────────────────────────────────────────────────────────────────────────
import nodemailer from 'nodemailer';

let transportador = null;

function obtenerTransportador() {
  if (!transportador) {
    transportador = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }
  return transportador;
}

// ── Enviar el código de recuperación ───────────────────────────────────────────
export async function enviarCodigoRecuperacion(destinatario, nombre, codigo) {
  const asunto = 'Código de recuperación — NVR Monitor HIC';

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;
      background:#f4f4f4;padding:24px">
      <div style="background:#1a1a1a;padding:20px;border-radius:8px 8px 0 0;text-align:center">
        <span style="color:#d4a017;font-size:1.1rem;font-weight:700;letter-spacing:0.5px">
          NVR MONITOR HIC
        </span>
      </div>
      <div style="background:#ffffff;padding:28px 24px;border-radius:0 0 8px 8px">
        <p style="color:#1a1a1a;font-size:0.95rem;margin:0 0 12px">Hola ${nombre},</p>
        <p style="color:#444;font-size:0.9rem;line-height:1.5;margin:0 0 20px">
          Recibimos una solicitud para restablecer tu contraseña. Usa este código
          para continuar — es válido por 15 minutos:
        </p>
        <div style="background:#f4f4f4;border:1px dashed #d4a017;border-radius:6px;
          padding:16px;text-align:center;margin-bottom:20px">
          <span style="font-size:1.8rem;font-weight:700;letter-spacing:6px;color:#1a1a1a">
            ${codigo}
          </span>
        </div>
        <p style="color:#888;font-size:0.8rem;line-height:1.5;margin:0">
          Si tú no solicitaste este cambio, ignora este correo — tu contraseña
          actual sigue siendo válida y no se tomó ninguna acción.
        </p>
      </div>
    </div>`;

  await obtenerTransportador().sendMail({
    from: `"NVR Monitor HIC" <${process.env.GMAIL_USER}>`,
    to: destinatario,
    subject: asunto,
    html
  });
}