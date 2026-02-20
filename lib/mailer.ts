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
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
}

export type EventConfig = {
  eventName?: string;
  eventVenue?: string;
  eventDate?: string;
  eventTime?: string;
};

export async function sendQrEmail(
  to: string,
  name: string | undefined,
  code: string,
  options: {
    eventConfig?: EventConfig;
    transport?: ReturnType<typeof createTransport>;
  } = {}
) {
  const transport = options.transport || createTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const safeName = name && name.trim().length > 0 ? name : "Participant";
  const qrImgUrl = `https://quickchart.io/qr?size=200&text=${encodeURIComponent(code)}`;

  const config = options.eventConfig || {};
  const EVENT_NAME = config.eventName || process.env.EVENT_NAME || "the event";
  const EVENT_VENUE = config.eventVenue || process.env.EVENT_VENUE || "Venue TBD";
  const EVENT_DATE = config.eventDate || process.env.EVENT_DATE || "Date TBD";
  const EVENT_TIME = config.eventTime || process.env.EVENT_TIME || "Time TBD";

  const subject = `Your Unique QR Code for ${EVENT_NAME}`;

  const text = `Dear ${safeName},\n\n` +
    `Thank you for registering for ${EVENT_NAME}.\n\n` +
    `Venue: ${EVENT_VENUE}\n` +
    `Date: ${EVENT_DATE}\n` +
    `Time: ${EVENT_TIME}\n\n` +
    `Please find your unique QR code below. This QR code is essential for your participation in the event.\n\n` +
    `Your QR Code URL: ${qrImgUrl}\n\n` +
    `Instructions for the Event Day:\n` +
    `* Check-in: Please present this QR code at the registration desk for scanning. This will confirm your attendance.\n` +
    `* E-Certificate: Your attendance record, captured via this QR code, will be used to issue your E-Certificate of Participation.\n\n` +
    `Important:\n` +
    `Please keep this email and your QR code safe. It is required for a smooth check-in process.\n\n` +
    `For any further updates regarding the event, please join our Telegram group: https://t.me/+uztdXAOJIXo3YTZl\n\n` +
    `We look forward to seeing you at the event.\n\n` +
    `Best Regards,\n\n` +
    `The IEEE SB GEHU Team`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
            /* Base Reset */
            body { margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f4; color: #333; line-height: 1.6; }
            
            /* Layout */
            .wrapper { width: 100%; table-layout: fixed; background-color: #f4f4f4; padding-bottom: 40px; }
            .webkit { max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border-radius: 12px; overflow: hidden; margin-top: 40px; }
            
            /* Header */
            .header { background: linear-gradient(135deg, #00629B 0%, #003057 100%); padding: 30px 20px; text-align: center; }
            .logo { font-size: 28px; font-weight: bold; color: #ffffff; letter-spacing: 1px; margin: 0; }
            .event-subtitle { color: rgba(255,255,255,0.8); font-size: 14px; text-transform: uppercase; margin-top: 5px; letter-spacing: 1.5px; }

            /* Content */
            .content { padding: 30px; text-align: left; }
            .greeting { font-size: 18px; margin-bottom: 20px; color: #111; }
            .intro-text { color: #555; margin-bottom: 24px; }
            
            /* Event Details Card */
            .details-card { background-color: #f8f9fa; border-left: 4px solid #00629B; padding: 15px 20px; margin-bottom: 30px; border-radius: 4px; }
            .detail-row { margin-bottom: 8px; }
            .detail-label { font-weight: 700; color: #00629B; width: 60px; display: inline-block; }
            .detail-value { color: #333; }

            /* QR Code Section */
            .qr-section { text-align: center; background-color: #ffffff; border: 2px dashed #ddd; border-radius: 12px; padding: 20px; margin: 0 20px 30px 20px; }
            .qr-label { font-size: 12px; font-weight: 600; color: #888; text-transform: uppercase; margin-bottom: 15px; letter-spacing: 1px; }
            .qr-img { max-width: 200px; height: auto; display: block; margin: 0 auto; }
            
            /* Instructions */
            .instructions { background-color: #ffffff; margin-top: 20px; }
            .section-title { font-size: 16px; font-weight: 700; color: #111; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
            .checklist { padding-left: 0; list-style: none; margin: 0; }
            .checklist li { margin-bottom: 12px; padding-left: 24px; position: relative; color: #555; }
            .checklist li:before { content: "•"; color: #00629B; font-weight: bold; font-size: 18px; position: absolute; left: 0; top: -2px; }
            
            /* Button */
            .btn-container { text-align: center; margin-top: 30px; }
            .btn { display: inline-block; background-color: #0088cc; color: #ffffff; padding: 12px 28px; border-radius: 30px; text-decoration: none; font-weight: 600; font-size: 14px; transition: background-color 0.3s; box-shadow: 0 4px 6px rgba(0,136,204,0.2); }
            .btn:hover { background-color: #0077b5; }

            /* Footer */
            .footer { background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #999; }
            .footer a { color: #999; text-decoration: underline; }
            
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="webkit">
                <!-- Header -->
                <div class="header">
                    <div class="logo">IEEE-SB GEHU</div>
                    <div class="event-subtitle">Event Registration Confirmed</div>
                </div>

                <!-- Main Content -->
                <div class="content">
                    <div class="greeting">Hello, <strong>${escapeHtml(safeName)}</strong></div>
                    <p class="intro-text">You are successfully registered for <strong>${escapeHtml(EVENT_NAME)}</strong>. We are thrilled to have you with us!</p>

                    <!-- Event Details -->
                    <div class="details-card">
                        <div class="detail-row">
                            <span class="detail-label">DATE</span>
                            <span class="detail-value">${escapeHtml(EVENT_DATE)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">TIME</span>
                            <span class="detail-value">${escapeHtml(EVENT_TIME)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">VENUE</span>
                            <span class="detail-value">${escapeHtml(EVENT_VENUE)}</span>
                        </div>
                    </div>

                    <!-- QR Code -->
                    <div class="qr-section">
                        <div class="qr-label">Your Entry Pass</div>
                        <img src="${qrImgUrl}" alt="QR Code" class="qr-img" />
                        <p style="margin-top:15px; font-size: 12px; color: #999;">Scan at the registration desk</p>
                    </div>

                    <!-- Instructions -->
                    <div class="instructions">
                        <div class="section-title">Important Instructions</div>
                        <ul class="checklist">
                            <li><strong>Reporting Time:</strong> Please ensure you arrive at the venue 30 minutes prior to the scheduled start time.</li>
                            <li><strong>Check-in Required:</strong> Present the QR code above at the desk to mark your attendance.</li>
                            <li><strong>E-Certificate:</strong> This QR scan is mandatory for your participation certificate.</li>
                            <li><strong>Online Participants:</strong> If you are attending virtually, please ignore the physical check-in requirement. (Only if event is hybrid)</li>
                            <li><strong>Stay Updated:</strong> Join our community for live updates using the button below.</li>
                        </ul>
                    </div>

                    <!-- CTA -->
                    <div class="btn-container">
                        <a href="https://linktr.ee/IEEE_SB_GEHU" class="btn">Connect with Us</a>
                    </div>
                </div>

                <!-- Footer -->
                <div class="footer">
                    <p>&copy; ${new Date().getFullYear()} IEEE Student Branch GEHU. All rights reserved.</p>
                    <p>This is an automated email. Please do not reply.</p>
                </div>
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
