import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { markStudentPresent } from "@/lib/google-sheets"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { qrId } = await request.json()

    if (!qrId) {
      return NextResponse.json({ error: "QR ID is required" }, { status: 400 })
    }


    const result = await markStudentPresent(
      qrId,
      session.user.email || "unknown",
      session.user.name || "Unknown Volunteer",
    )

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        student: result.student,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          student: result.student,
        },
        { status: 400 },
      )
    }
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
