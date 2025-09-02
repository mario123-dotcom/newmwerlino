import { readFile } from "fs/promises";
import fetch from "node-fetch";
import nodemailer from "nodemailer";
import path from "path";

/**
 * Send the final video via WhatsApp or email, preferring WhatsApp when both
 * configurations are available. The function checks environment variables for
 * credentials and silently skips if none are provided.
 */
export async function sendFinalVideo(filePath: string): Promise<void> {
  // Prefer WhatsApp if credentials exist
  if (
    process.env.WHATSAPP_TOKEN &&
    process.env.WHATSAPP_PHONE_ID &&
    process.env.WHATSAPP_TO
  ) {
    await sendViaWhatsApp(filePath);
    return;
  }

  // Fallback to email
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.EMAIL_FROM &&
    process.env.EMAIL_TO
  ) {
    await sendViaEmail(filePath);
    return;
  }

  console.warn("[WARN] Nessuna configurazione per l'invio del video trovata");
}

async function sendViaWhatsApp(filePath: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN!;
  const phoneId = process.env.WHATSAPP_PHONE_ID!;
  const to = process.env.WHATSAPP_TO!;

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("to", to);
  form.append("type", "video");
  const buff = await readFile(filePath);
  form.append(
    "video",
    new Blob([buff.buffer as ArrayBuffer]),
    path.basename(filePath)
  );

  const res = await fetch(
    `https://graph.facebook.com/v17.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WhatsApp API error: ${text}`);
  }

  console.log("[LOG] Video inviato via WhatsApp");
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
    to: process.env.EMAIL_TO!,
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
