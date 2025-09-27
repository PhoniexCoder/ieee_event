import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getGoogleSheetsClient, getSpreadsheetConfig, resolveMapping } from "@/lib/google-sheets";
import { sendQrEmail } from "@/lib/mailer";

// Helper to create a simple random QR code (UUID)
function generateQrId() {
  // Prefer crypto.randomUUID when available
  if (typeof (globalThis as any).crypto?.randomUUID === "function") {
    return (globalThis as any).crypto.randomUUID();
  }
  // Fallback
  const rnd = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `qr_${ts}_${rnd}`;
}

async function isAuthorized(req: Request) {
  // Allow via CRON secret header
  const secret = process.env.CRON_SECRET;
  const hdr = req.headers.get("x-cron-secret");
  if (secret && hdr && hdr === secret) return true;
  // Allow when called by Vercel Scheduler (adds x-vercel-cron header)
  const vercelCron = req.headers.get("x-vercel-cron");
  if (vercelCron) return true;
  // Allow via query parameter (for Vercel Cron which cannot set headers)
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("secret");
    if (secret && q && q === secret) return true;
  } catch {}
  // Otherwise require admin session
  const session: any = await getServerSession(authOptions as any);
  return (session?.user?.role === "admin");
}

export async function GET(req: Request) {
  const ok = await isAuthorized(req);
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runProvision(req);
}

export async function POST(req: Request) {
  const ok = await isAuthorized(req);
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runProvision(req);
}

async function runProvision(req: Request) {
  try {
    const sheets = await getGoogleSheetsClient();
    const { spreadsheetId, activeSheetTitle } = await getSpreadsheetConfig();
    const { mapping, indexMap } = await resolveMapping(spreadsheetId, activeSheetTitle);

    const neededHeaders = [mapping.emailHeader, mapping.nameHeader, mapping.eventNameHeader, mapping.qrHeader, mapping.qrCodeHeader]
      .filter(Boolean) as string[];
    const idxs = neededHeaders.map(h => indexMap.get(h) ?? -1).filter(i => i >= 0).sort((a,b)=>a-b);
    if (idxs.length === 0) {
      return NextResponse.json({ updated: 0, emailed: 0, message: "No relevant headers found" });
    }
    const start = idxs[0];
    const end = idxs[idxs.length - 1];
    const startA1 = colIndexToA1Local(start);
    const endA1 = colIndexToA1Local(end);

    // Fetch a large range to cover possible new rows
    const range = `${activeSheetTitle}!${startA1}2:${endA1}1000`;
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = resp.data.values || [];

    const offset = start;
    const getVal = (row: any[], header?: string) => {
      if (!header) return "";
      const idx = (indexMap.get(header) ?? 0) - offset;
      return (row[idx] || "").toString().trim();
    };
    const setIdx = (header: string) => (indexMap.get(header)! - offset);
    const getQrCodeUrl = (code: string) => `https://quickchart.io/qr?size=220&text=${encodeURIComponent(code)}`;

  type Job = { rowIndex: number; email: string; name?: string; eventName?: string; code: string };
    const jobs: Job[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || [];
  const email = getVal(row, mapping.emailHeader);
  const name = getVal(row, mapping.nameHeader);
  const eventName = mapping.eventNameHeader ? getVal(row, mapping.eventNameHeader) : activeSheetTitle;
      const qrId = getVal(row, mapping.qrHeader);
      const qrCode = mapping.qrCodeHeader ? getVal(row, mapping.qrCodeHeader) : "";
      if (email && !qrId) {
        const code = generateQrId();
        // Prepare to write values back into the cached rows array
        row[setIdx(mapping.qrHeader)] = code;
        if (mapping.qrCodeHeader) {
          row[setIdx(mapping.qrCodeHeader)] = getQrCodeUrl(code);
        }
  jobs.push({ rowIndex: i + 2, email, name, eventName, code });
      }
    }

    // Write updates if any
    let updated = 0;
    if (jobs.length > 0) {
      const valuesRange = `${activeSheetTitle}!${startA1}2:${endA1}${rows.length + 1}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: valuesRange,
        valueInputOption: "RAW",
        requestBody: { values: rows },
      });
      updated = jobs.length;
    }

    // Send emails (best-effort)
    let emailed = 0;
    for (const j of jobs) {
      try {
        await sendQrEmail(j.email, j.name, j.code, j.eventName);
        emailed++;
      } catch (e) {
        console.error("[provision] email failed for", j.email, e);
      }
    }

    return NextResponse.json({ updated, emailed });
  } catch (error: any) {
    console.error("[provision] error:", error);
    return NextResponse.json({ error: error?.message || "Provisioning failed" }, { status: 500 });
  }
}

// Local A1 helper (duplicate to avoid circular import)
function colIndexToA1Local(idx: number) {
  let n = idx + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
