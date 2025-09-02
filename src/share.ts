import nodemailer from "nodemailer";
import path from "path";

// Destinatario fisso per l'invio del video finale
const DEST_EMAIL = "mariostanco644@gmail.com";

/**
 * Invia il video finale via email se la configurazione SMTP è disponibile.
 * Se le variabili d'ambiente non sono impostate, registra un avviso e non fa nulla.
 */
export async function sendFinalVideo(filePath: string): Promise<void> {
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.EMAIL_FROM
  ) {
    await sendViaEmail(filePath);
  } else {
    console.warn(
      "[WARN] Configurazione email mancante, impossibile inviare il video"
    );
  }
}

async function sendViaEmail(filePath: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM!,
    to: DEST_EMAIL,
    subject: "Video creato",
    text: "Il video finale è pronto.",
    attachments: [
      {
        filename: path.basename(filePath),
        path: filePath,
      },
    ],
  });

  console.log("[LOG] Video inviato via email");
}
