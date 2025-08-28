import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getStudents } from "@/lib/google-sheets"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can view all students
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }


    const students = await getStudents()

    return NextResponse.json(students)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
