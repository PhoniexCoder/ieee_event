import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { markStudentPresent } from "@/lib/google-sheets"

export async function POST(request: NextRequest) {
  let response;
  try {
  const session = await getServerSession(authOptions);

    if (!session?.user) {
      response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    } else {
      const { qrId } = await request.json();
      if (!qrId) {
        response = NextResponse.json({ error: "QR ID is required" }, { status: 400 });
      } else {
        const result = await markStudentPresent(
          qrId,
          session.user.email || "unknown",
          session.user.name || "Unknown Volunteer",
        );
        if (result.success) {
          response = NextResponse.json({
            success: true,
            message: result.message,
            student: result.student,
          });
        } else {
          response = NextResponse.json(
            {
              success: false,
              message: result.message,
              student: result.student,
            },
            { status: 400 },
          );
        }
      }
    }
  } catch (error) {
    console.error("[API /api/attendance/scan] Unhandled error:", error);
    response = NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
  }
  return response;
}
