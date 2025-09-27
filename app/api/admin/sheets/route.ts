import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import clientPromise from "@/lib/mongodb";
import { getGoogleSheetsClient } from "@/lib/google-sheets";

// GET: list sheets (tabs) in the configured spreadsheet
export async function GET() {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'ieee_attendance');
    const configColl = db.collection("config");
    const ssDoc = await configColl.findOne<{ value: string }>({ name: "spreadsheetId" });
    if (!ssDoc?.value) {
      return NextResponse.json({ error: "Spreadsheet ID not set" }, { status: 400 });
    }

    const sheetsApi = await getGoogleSheetsClient();
    const meta = await sheetsApi.spreadsheets.get({ spreadsheetId: ssDoc.value });
    const sheets = (meta.data.sheets || []).map((s) => ({
      title: s.properties?.title || "",
      sheetId: s.properties?.sheetId || 0,
      index: s.properties?.index ?? 0,
    }));

    const active = await configColl.findOne<{ sheetId?: number; title?: string }>({ name: "activeSheet" });

    return NextResponse.json({ sheets, active });
  } catch (error) {
    console.error("[admin/sheets] GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST: set active sheet by id/title
export async function POST(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { sheetId, title } = await request.json();
    if (typeof sheetId !== "number" && typeof title !== "string") {
      return NextResponse.json({ error: "sheetId (number) or title (string) is required" }, { status: 400 });
    }
    const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'ieee_attendance');
    await db.collection("config").updateOne(
      { name: "activeSheet" },
      { $set: { sheetId, title } },
      { upsert: true },
    );
    return NextResponse.json({ message: "Active sheet updated" });
  } catch (error) {
    console.error("[admin/sheets] POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
