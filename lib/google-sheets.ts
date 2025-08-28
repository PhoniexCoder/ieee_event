// Fetch all students from the Google Sheet
export async function getStudents(): Promise<Student[]> {
  try {
    const sheets = await getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    // Update the range and mapping for your actual sheet structure
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Form responses 1!A2:L1000", // A-L columns, adjust if more columns exist
    });
    const rows = response.data.values || [];
    return rows.map((row, idx) => ({
      name: row[1] || "",           // Your Name (B)
      email: row[3] || "",          // Email ID (D)
      rollNumber: row[4] || "",     // Student ID (E)
      section: row[5] || "",        // Section (F)
      qrId: row[8] || "",           // QR_ID (I)
      attendance: row[10] || "",    // Attendence (K)
      rowIndex: idx + 2,             // +2 because sheet rows start at 2 (A2)
    }));
  } catch (error) {
    console.error("[] Error fetching students:", error);
    return [];
  }
}
import { google } from "googleapis"

// Initialize Google Sheets API client
export async function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })

  const sheets = google.sheets({ version: "v4", auth })
  return sheets
}

// Student data interface
export interface Student {
  name: string
  email: string
  rollNumber: string
  section: string
  qrId: string
  attendance: "Present" | "Absent"
  rowIndex: number
}

// Attendance log interface
export interface AttendanceLog {
  volunteerId: string
  volunteerName: string
  studentId: string
  studentName: string
  timestamp: string
  action: "marked_present"
}


// Get total number of students (rows) from the sheet
export async function getTotalStudents(): Promise<number> {
  try {
    const sheets = await getGoogleSheetsClient()
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Form responses 1!A2:A1000", // Only fetch first column for row count
    })

    const rows = response.data.values || []
    return rows.length
  } catch (error) {
    console.error("[] Error fetching total students:", error)
    throw new Error("Failed to fetch total students from Google Sheets")
  }
}

// Find student by QR ID
export async function findStudentByQrId(qrId: string): Promise<Student | null> {
  try {
    const students = await getStudents()
    return students.find((student) => student.qrId === qrId) || null
  } catch (error) {
    console.error("[] Error finding student:", error)
    return null
  }
}

// Mark student as present
export async function markStudentPresent(
  qrId: string,
  volunteerId: string,
  volunteerName: string,
): Promise<{ success: boolean; student?: Student; message: string }> {
  try {
    const student = await findStudentByQrId(qrId)

    if (!student) {
      return { success: false, message: "Student not found" }
    }

    if (student.attendance === "Present") {
      return { success: false, message: "Student already marked present", student }
    }

    const sheets = await getGoogleSheetsClient()
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID

    // Update attendance status
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Students!F${student.rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [["Present"]],
      },
    })

    // Highlight the row in green
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0, // Assuming Students sheet is the first sheet
                startRowIndex: student.rowIndex - 1,
                endRowIndex: student.rowIndex,
                startColumnIndex: 0,
                endColumnIndex: 6,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: {
                    red: 0.8,
                    green: 1.0,
                    blue: 0.8,
                  },
                },
              },
              fields: "userEnteredFormat.backgroundColor",
            },
          },
        ],
      },
    })

    // Log the attendance action
    await logAttendanceAction({
      volunteerId,
      volunteerName,
      studentId: qrId,
      studentName: student.name,
      timestamp: new Date().toISOString(),
      action: "marked_present",
    })

    return {
      success: true,
      student: { ...student, attendance: "Present" },
      message: "Student marked present successfully",
    }
  } catch (error) {
    console.error("[] Error marking student present:", error)
    return { success: false, message: "Failed to update attendance" }
  }
}

// Log attendance action to audit sheet
export async function logAttendanceAction(log: AttendanceLog): Promise<void> {
  try {
    const sheets = await getGoogleSheetsClient()
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Logs!A:F",
      valueInputOption: "RAW",
      requestBody: {
        values: [[log.volunteerId, log.volunteerName, log.studentId, log.studentName, log.timestamp, log.action]],
      },
    })
  } catch (error) {
    console.error("[] Error logging attendance action:", error)
    // Don't throw error for logging failures
  }
}

// Get attendance statistics
export async function getAttendanceStats(): Promise<{
  totalStudents: number
  presentStudents: number
  absentStudents: number
  attendanceRate: number
}> {
  try {
    const totalStudents = await getTotalStudents()
    // Optionally, fetch present/absent students if needed, or set to 0 for now
    return {
      totalStudents,
      presentStudents: 0,
      absentStudents: 0,
      attendanceRate: 0,
    }
  } catch (error) {
    console.error("[] Error getting attendance stats:", error)
    return {
      totalStudents: 0,
      presentStudents: 0,
      absentStudents: 0,
      attendanceRate: 0,
    }
  }
}

// Get recent attendance logs
export async function getRecentLogs(limit = 10): Promise<AttendanceLog[]> {
  try {
    const sheets = await getGoogleSheetsClient()
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Logs!A2:F1000",
    })

    const rows = response.data.values || []

    return rows
      .map((row) => ({
        volunteerId: row[0] || "",
        volunteerName: row[1] || "",
        studentId: row[2] || "",
        studentName: row[3] || "",
        timestamp: row[4] || "",
        action: (row[5] as "marked_present") || "marked_present",
      }))
      .slice(-limit)
      .reverse()
  } catch (error) {
    console.error("[] Error fetching recent logs:", error)
    return []
  }
}
