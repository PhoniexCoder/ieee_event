import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";

export async function GET() {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || "ieee_attendance");
    // Ping the server to check connectivity
    await db.command({ ping: 1 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const error = err as any;
    const message = error?.message || "Unknown error";
    const code = error?.code;
    const labels = Array.from(error?.errorLabelSet || []);
    return NextResponse.json({ ok: false, message, code, labels }, { status: 503 });
  }
}
