import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { handleApiError, ApiError } from "@/lib/handle-api-error";

export async function GET() {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session || session.user?.role !== "admin") {
      const error = new ApiError("Forbidden", 403);
      return handleApiError(error, "/api/health/db");
    }
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || "ieee_attendance");
    await db.command({ ping: 1 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "/api/health/db");
  }
}
