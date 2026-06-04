import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth-options"
import { markStudentPresent } from "@/lib/google-sheets"
import { rateLimit } from "@/lib/rate-limiter"
import { handleApiError } from "@/lib/handle-api-error"

// Trusted-proxy assumption: In production behind a reverse proxy (Vercel, Cloudflare, etc.),
// x-forwarded-for and x-real-ip are set by the platform and can be trusted.
// request.ip is preferred as it's set directly by the platform and cannot be spoofed via headers.
function getClientIp(request: NextRequest): string {
  if (request.ip) return request.ip
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const ip = forwarded.split(",").map((s) => s.trim()).find(Boolean)
    if (ip) return ip
  }
  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp
  return "unknown"
}

export async function POST(request: NextRequest) {
  let response;
  try {
    const ip = getClientIp(request)
    const key = ip === "unknown" ? "scan:untrusted" : `scan:${ip}`
    const maxReqs = ip === "unknown" ? 5 : 30
    if (!rateLimit(key, maxReqs, 60000)) {
      return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });
    }
  const session: any = await getServerSession(authOptions as any);

    if (!session?.user) {
      response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    } else {
      const { qrId } = await request.json();
      if (!qrId) {
        response = NextResponse.json({ error: "QR ID is required" }, { status: 400 });
      } else {
        const result = await markStudentPresent(
          qrId,
          session.user?.email || "unknown",
          session.user?.name || "Unknown Volunteer",
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
    return handleApiError(error, "/api/attendance/scan");
  }
  return response;
}
