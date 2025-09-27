import nodemailer from "nodemailer";

export type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

function getConfigFromEnv(): MailConfig {
  const host = process.env.SMTP_HOST || "";
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = (process.env.SMTP_SECURE || "false").toLowerCase() === "true" || port === 465;
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "";
  if (!host || !user || !pass || !from) {
    throw new Error("SMTP is not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.");
  }
  return { host, port, secure, user, pass, from };
}

export function createTransport() {
  const cfg = getConfigFromEnv();
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

export async function sendQrEmail(to: string, name: string | undefined, code: string) {
  const transport = createTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const safeName = name && name.trim().length > 0 ? name : "Participant";
  const qrImgUrl = `https://quickchart.io/qr?size=220&text=${encodeURIComponent(code)}`;
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #111">
      <p>Hi ${safeName},</p>
      <p>Welcome! Your unique QR code for event check-in is below.</p>
      <p><strong>Code:</strong> <code style="background:#f2f2f2;padding:2px 6px;border-radius:4px">${code}</code></p>
      <p><img src="${qrImgUrl}" alt="QR Code" width="220" height="220"/></p>
      <p>If the image doesn't load, you can also open this link:<br/>
      <a href="${qrImgUrl}">${qrImgUrl}</a></p>
      <p>See you at the event!</p>
    </div>
  `;
  const text = `Hi ${safeName},\n\nYour unique QR code for event check-in is: ${code}\nQR Link: ${qrImgUrl}\n\nSee you at the event!`;
  await transport.sendMail({ from, to, subject: "Your Event QR Code", text, html });
}
