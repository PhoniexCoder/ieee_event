import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";

export async function GET() {
  try {
  const session: any = await getServerSession(authOptions as any);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'ieee_attendance');
    const config = await db.collection("config").findOne({ name: "spreadsheetId" });
    return NextResponse.json({ spreadsheetId: config ? config.value : null });
  } catch (error) {
    console.error("Error getting spreadsheetId:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
  const session: any = await getServerSession(authOptions as any);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { spreadsheetId } = await request.json();
    if (!spreadsheetId) {
      return NextResponse.json({ error: "spreadsheetId is required" }, { status: 400 });
    }
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'ieee_attendance');
    await db.collection("config").updateOne(
      { name: "spreadsheetId" },
      { $set: { value: spreadsheetId } },
      { upsert: true }
    );
    // Reset any previously selected activeSheet to avoid mismatches across spreadsheets
    await db.collection("config").deleteOne({ name: "activeSheet" });
    return NextResponse.json({ message: "Spreadsheet ID updated successfully" });
  } catch (error) {
    console.error("Error updating spreadsheetId:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}