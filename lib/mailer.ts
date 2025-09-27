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

export async function sendQrEmail(to: string, name: string | undefined, code: string, eventNameOverride?: string) {
  const transport = createTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const safeName = name && name.trim().length > 0 ? name : "Participant";
  const qrImgUrl = `https://quickchart.io/qr?size=220&text=${encodeURIComponent(code)}`;

  const EVENT_NAME = eventNameOverride || process.env.EVENT_NAME || "the event";

  const subject = `Your Unique QR Code for ${EVENT_NAME}`;

  const text = `Dear ${safeName},\n\n` +
    `Thank you for registering for ${EVENT_NAME}.\n\n` +
    `Please find your unique QR code below. This QR code is essential for your participation in the event.\n\n` +
    `Your QR Code URL: ${qrImgUrl}\n\n` +
    `Instructions for the Event Day:\n` +
    `- Check-in: Please present this QR code at the registration desk for scanning. This will confirm your attendance.\n` +
    `- E-Certificate: Your attendance record, captured via this QR code, will be used to issue your E-Certificate of Participation.\n\n` +
    `Important:\n` +
    `Please keep this email and your QR code safe. It is required for a smooth check-in process.\n\n` +
    `Further Updates will be share through whatsapp group you joined.\n\n` +
    `We look forward to seeing you at the event.\n\n` +
    `Best Regards,\n\n` +
    `The IEEE SB GEHU Team`;

  const html = `
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
            body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #111; margin: 0; padding: 0; }
            .container { max-width: 640px; margin: 0 auto; padding: 20px; }
            .card { border: 1px solid #ddd; border-radius: 10px; padding: 20px; }
            .header { font-size: 22px; font-weight: 700; text-align: center; margin-bottom: 16px; color: #333; }
            .qr-code { text-align: center; margin: 24px 0; }
            .instructions { margin-top: 16px; background-color: #f9f9f9; padding: 16px; border-radius: 8px; }
            h3 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 6px; margin-top: 0; }
            ul { padding-left: 20px; margin: 8px 0; }
            .footer { margin-top: 24px; font-size: 12px; text-align: center; color: #888; }
            .kv p { margin: 4px 0; }
        </style>
    </head>
    <body>
        <div class="container">
          <div class="card">
            <div class="header">Your Unique QR Code for ${escapeHtml(EVENT_NAME)}</div>
            <p>Dear ${escapeHtml(safeName)},</p>
            <p>Thank you for registering for <strong>${escapeHtml(EVENT_NAME)}</strong>.</p>
            <p>Please find your unique QR code below. This QR code is essential for your participation in the event.</p>
            <div class="qr-code">
                <img src="${qrImgUrl}" alt="Your QR Code" width="220" height="220" />
            </div>
            <p><strong>Your QR Code URL:</strong> <a href="${qrImgUrl}">${qrImgUrl}</a></p>
            <div class="instructions">
                <h3>Instructions for the Event Day</h3>
                <ul>
                    <li><strong>Check-in:</strong> Please present this QR code at the registration desk for scanning. This will confirm your attendance.</li>
                    <li><strong>E-Certificate:</strong> Your attendance record, captured via this QR code, will be used to issue your E-Certificate of Participation.</li>
                </ul>
                <h3>Important</h3>
                <p>Please keep this email and your QR code safe, as it is required for a smooth check-in process.</p>
                <p>Further Updates will be share through whatsapp group you joined.</p>
            </div>
            <p>We look forward to seeing you at the event.</p>
            <p>Best Regards,</p>
            <p><strong>The IEEE SB GEHU Team</strong></p>
          </div>
          <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
    </body>
    </html>
  `;

  await transport.sendMail({ from, to, subject: subject, text, html });
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
