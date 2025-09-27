import { google } from "googleapis";
import clientPromise from "@/lib/mongodb";

// Read Spreadsheet configuration from MongoDB to avoid HTTP calls and auth coupling
export async function getSpreadsheetConfig(): Promise<{
  spreadsheetId: string;
  activeSheetTitle: string;
  activeSheetId?: number;
}> {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'ieee_attendance');
  const configColl = db.collection("config");
  const ssDoc = await configColl.findOne<{ value: string }>({ name: "spreadsheetId" });
  const envId = process.env.GOOGLE_SHEETS_ID;
  const spreadsheetId = ssDoc?.value || envId;
  if (!spreadsheetId) {
    throw new Error("Google Spreadsheet ID not found. Please set it in the admin dashboard or define GOOGLE_SHEETS_ID.");
  }

  // Attempt to get persisted active sheet
  let activeTitle = undefined as string | undefined;
  let activeId = undefined as number | undefined;
  const activeDoc = await configColl.findOne<{ sheetId?: number; title?: string }>({ name: "activeSheet" });
  if (activeDoc?.title) activeTitle = activeDoc.title;
  if (typeof activeDoc?.sheetId === "number") activeId = activeDoc.sheetId;

  // If not set, choose a default from spreadsheet metadata (prefer a sheet with 'Form responses' in title; otherwise first sheet)
  if (!activeTitle || typeof activeId !== "number") {
    const sheetsApi = await getGoogleSheetsClient();
    const meta = await sheetsApi.spreadsheets.get({ spreadsheetId });
    const list = meta.data.sheets || [];
    const preferred = list.find(s => (s.properties?.title || "").toLowerCase().includes("form responses"));
    const fallback = list[0];
    const chosen = preferred || fallback;
    const title = chosen?.properties?.title;
    const sid = chosen?.properties?.sheetId;
    if (!title || typeof sid !== "number") {
      throw new Error("Could not determine a default sheet from the spreadsheet metadata.");
    }
    activeTitle = activeTitle || title;
    if (typeof activeId !== "number") activeId = sid;
  }

  return {
    spreadsheetId,
    activeSheetTitle: activeTitle!,
    activeSheetId: activeId,
  };
}

// Initialize Google Sheets API client
export async function getGoogleSheetsClient() {
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY || "";
  // Normalize newlines and strip accidental wrapping quotes
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n").replace(/^\"|\"$/g, "");
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

// Ensure a sheet with the given title exists; if not, create it and return its sheetId
async function ensureSheetExists(spreadsheetId: string, title: string): Promise<number> {
  const sheetsApi = await getGoogleSheetsClient();
  const meta = await sheetsApi.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets?.find((s) => s.properties?.title === title);
  const sid = existing?.properties?.sheetId;
  if (typeof sid === "number") return sid;
  const addRes = await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title },
          },
        },
      ],
    },
  });
  const added = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (typeof added !== "number") {
    throw new Error(`Failed to create sheet '${title}'`);
  }
  return added;
}

// Student data interface
export interface Student {
  name: string;
  email: string;
  rollNumber: string;
  section: string;
  qrId: string;
  attendance: string;
  rowIndex: number;
}

// Attendance log interface
export interface AttendanceLog {
  volunteerId: string;
  volunteerName: string;
  studentId: string;
  studentName: string;
  timestamp: string;
  action: "marked_present";
}

// Fetch all students from the Google Sheet
// Utility: convert 0-based column index to A1 letter(s)
function colIndexToA1(idx: number): string {
  let n = idx + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Fetch header row and build a header->index map
async function getHeaderMap(spreadsheetId: string, sheetTitle: string): Promise<Map<string, number>> {
  const sheets = await getGoogleSheetsClient();
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetTitle}!1:1` });
  const headers = (resp.data.values?.[0] as string[]) || [];
  const map = new Map<string, number>();
  headers.forEach((h, i) => map.set(h.trim(), i));
  return map;
}

type SheetMapping = {
  qrHeader: string;
  qrCodeHeader?: string;
  attendanceHeader: string;
  nameHeader?: string;
  emailHeader?: string;
  rollHeader?: string;
  sectionHeader?: string;
  eventNameHeader?: string;
};

export async function resolveMapping(spreadsheetId: string, sheetTitle: string): Promise<{ mapping: SheetMapping; indexMap: Map<string, number> }>{
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'ieee_attendance');
  const configColl = db.collection("config");
  const saved = await configColl.findOne<Partial<SheetMapping>>({ name: "sheetMapping" } as any);
  const indexMap = await getHeaderMap(spreadsheetId, sheetTitle);
  const headersLower = Array.from(indexMap.keys()).map(h => h.toLowerCase());
  const findHeader = (candidates: string[]) => {
    const lcSet = new Set(headersLower);
    // exact match (case-insensitive)
    for (const c of candidates) {
      const idx = headersLower.indexOf(c.toLowerCase());
      if (idx !== -1) return Array.from(indexMap.keys())[idx];
    }
    // substring match
    for (const c of candidates) {
      const hit = Array.from(indexMap.keys()).find(h => h.toLowerCase().includes(c.toLowerCase()));
      if (hit) return hit;
    }
    return undefined;
  };

  // Enforce QR column to be exactly 'QR_ID'
  const requiredQrHeader = "QR_ID";
  if (!indexMap.has(requiredQrHeader)) {
    throw new Error(`Required QR column '${requiredQrHeader}' not found on sheet '${sheetTitle}'. Please rename the QR column to 'QR_ID'.`);
  }

  const inferred: SheetMapping = {
    qrHeader: requiredQrHeader,
    qrCodeHeader: indexMap.has("QR_CODE") ? "QR_CODE" : undefined,
    attendanceHeader: saved?.attendanceHeader || findHeader(["Attendance", "Confirmation", "Checked In", "Check-In", "Checkin"]) || "Confirmation",
    nameHeader: saved?.nameHeader || (indexMap.has("Full Name") ? "Full Name" : (findHeader(["Your Name", "Name"]) || undefined)),
    emailHeader: saved?.emailHeader || findHeader(["Email address", "Email", "Email ID"]) || "Email address",
    rollHeader: saved?.rollHeader || findHeader(["University Roll No.", "Student ID", "Roll No"]) || "University Roll No.",
    sectionHeader: saved?.sectionHeader || findHeader(["Course", "Year", "Section"]) || "Course",
    eventNameHeader: saved?.eventNameHeader || findHeader([
      "Which event(s) would you like to register for",
      "Event Name",
      "Event Title",
      "Event"
    ]) || undefined,
  };
  return { mapping: inferred, indexMap };
}

export async function getStudents(): Promise<Student[]> {
  try {
    const sheets = await getGoogleSheetsClient();
    const { spreadsheetId, activeSheetTitle } = await getSpreadsheetConfig();
    const { mapping, indexMap } = await resolveMapping(spreadsheetId, activeSheetTitle);
    // Compute minimal span from the selected fields
    const indices = [mapping.nameHeader, mapping.emailHeader, mapping.rollHeader, mapping.sectionHeader, mapping.qrHeader, mapping.attendanceHeader]
      .filter((h): h is string => !!h)
      .map(h => indexMap.get(h) ?? -1)
      .filter(i => i >= 0)
      .sort((a,b)=>a-b);
    if (indices.length === 0) return [];
    const start = indices[0];
    const end = indices[indices.length - 1];
    const range = `${activeSheetTitle}!${colIndexToA1(start)}2:${colIndexToA1(end)}1000`;
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = resp.data.values || [];
    // We need mapping offsets within the slice
    const offset = start;
    const getVal = (row: any[], header?: string) => {
      if (!header) return "";
      const idx = (indexMap.get(header) ?? 0) - offset;
      return row[idx] || "";
    };
    return rows.map((row, idx) => ({
      name: getVal(row, mapping.nameHeader),
      email: getVal(row, mapping.emailHeader),
      rollNumber: getVal(row, mapping.rollHeader),
      section: getVal(row, mapping.sectionHeader),
      qrId: getVal(row, mapping.qrHeader),
      attendance: getVal(row, mapping.attendanceHeader),
      rowIndex: idx + 2,
    }));
  } catch (error) {
    console.error("[] Error fetching students:", error);
    return [];
  }
}

// Get total number of students (rows) from the sheet
export async function getTotalStudents(): Promise<number> {
  try {
    const sheets = await getGoogleSheetsClient();
    const { spreadsheetId, activeSheetTitle } = await getSpreadsheetConfig();
    const { mapping, indexMap } = await resolveMapping(spreadsheetId, activeSheetTitle);
    const qrIdx = indexMap.get(mapping.qrHeader) ?? 0; // fallback to first column if missing
    const col = colIndexToA1(qrIdx);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${activeSheetTitle}!${col}2:${col}1000`,
    });
    const rows = response.data.values || [];
    return rows.length;
  } catch (error) {
    console.error("[] Error fetching total students:", error);
    throw new Error("Failed to fetch total students from Google Sheets");
  }
}

// Find student by QR ID
export async function findStudentByQrId(qrId: string): Promise<Student | null> {
  try {
    const sheets = await getGoogleSheetsClient();
    const { spreadsheetId, activeSheetTitle } = await getSpreadsheetConfig();
    const { mapping, indexMap } = await resolveMapping(spreadsheetId, activeSheetTitle);
    const qrIdx = indexMap.get(mapping.qrHeader);
    if (qrIdx === undefined) return null;
    const qrCol = colIndexToA1(qrIdx);
    const qrResp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${activeSheetTitle}!${qrCol}2:${qrCol}1000` });
    const qrRows = (qrResp.data.values as string[][]) || [];
    let foundIndex = -1;
    for (let i = 0; i < qrRows.length; i++) {
      const val = (qrRows[i]?.[0] || "").toString().trim();
      if (val === qrId) { foundIndex = i; break; }
    }
    if (foundIndex === -1) return null;
    const rowIndex = foundIndex + 2;
    // Fetch a slice covering the needed fields
    const fields = [mapping.nameHeader, mapping.emailHeader, mapping.rollHeader, mapping.sectionHeader, mapping.qrHeader, mapping.attendanceHeader].filter(Boolean) as string[];
    const fieldIdx = fields.map(h => indexMap.get(h) ?? -1).filter(i => i>=0).sort((a,b)=>a-b);
    const start = fieldIdx[0];
    const end = fieldIdx[fieldIdx.length-1];
    const range = `${activeSheetTitle}!${colIndexToA1(start)}${rowIndex}:${colIndexToA1(end)}${rowIndex}`;
    const rowResp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const row = (rowResp.data.values?.[0] as string[]) || [];
    const offset = start;
    const valAt = (header?: string) => {
      if (!header) return "";
      const idx = (indexMap.get(header) ?? 0) - offset;
      return row[idx] || "";
    };
    const student: Student = {
      name: valAt(mapping.nameHeader),
      email: valAt(mapping.emailHeader),
      rollNumber: valAt(mapping.rollHeader),
      section: valAt(mapping.sectionHeader),
      qrId: valAt(mapping.qrHeader),
      attendance: valAt(mapping.attendanceHeader),
      rowIndex,
    };
    return student;
  } catch (error) {
    console.error("[] Error finding student:", error);
    return null;
  }
}

// Mark student as present
export async function markStudentPresent(
  qrId: string,
  volunteerId: string,
  volunteerName: string
): Promise<{ success: boolean; student?: Student; message: string }> {
  try {
    const student = await findStudentByQrId(qrId);

    if (!student) {
      return { success: false, message: "Student not found" };
    }

    if (student.attendance === "Present") {
      return { success: false, message: "Student already marked present", student };
    }

    const sheets = await getGoogleSheetsClient();
    const { spreadsheetId, activeSheetTitle, activeSheetId } = await getSpreadsheetConfig();
    const { mapping, indexMap } = await resolveMapping(spreadsheetId, activeSheetTitle);
    const attIdx = indexMap.get(mapping.attendanceHeader);
    if (attIdx === undefined) {
      throw new Error(`Attendance column '${mapping.attendanceHeader}' not found`);
    }
    const attCol = colIndexToA1(attIdx);

    // Update attendance status
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${activeSheetTitle}!${attCol}${student.rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [["Present"]],
      },
    });

    // Determine the correct sheetId for the active sheet
    let sheetId = activeSheetId;
    if (sheetId === undefined) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const formSheet = meta.data.sheets?.find(
        (s) => s.properties?.title === activeSheetTitle
      );
      const sid = formSheet?.properties?.sheetId;
      sheetId = typeof sid === "number" ? sid : undefined;
    }
    if (sheetId === undefined) {
      throw new Error(`Could not find sheetId for '${activeSheetTitle}'`);
    }
    // Highlight the row in green
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: student.rowIndex - 1,
                endRowIndex: student.rowIndex,
                startColumnIndex: 0,
                endColumnIndex: 12, // A-L columns
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
    });

    // Log the attendance action
    await logAttendanceAction({
      volunteerId,
      volunteerName,
      studentId: qrId,
      studentName: student.name,
      timestamp: new Date().toISOString(),
      action: "marked_present",
    });

    return {
      success: true,
      student: { ...student, attendance: "Present" },
      message: "Student marked present successfully",
    };
  } catch (error) {
    console.error("[markStudentPresent] Error marking student present:", error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Failed to update attendance" };
  }
}

// Log attendance action to audit sheet
export async function logAttendanceAction(log: AttendanceLog): Promise<void> {
  try {
    const sheets = await getGoogleSheetsClient();
    const { spreadsheetId } = await getSpreadsheetConfig();

    // Make sure 'Logs' sheet exists
    await ensureSheetExists(spreadsheetId, "Logs");

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Logs!A:F",
      valueInputOption: "RAW",
      requestBody: {
        values: [[log.volunteerId, log.volunteerName, log.studentId, log.studentName, log.timestamp, log.action]],
      },
    });
  } catch (error) {
    console.error("[] Error logging attendance action:", error);
    // Don't throw error for logging failures
  }
}

// Get attendance statistics
export async function getAttendanceStats(): Promise<{
  totalStudents: number;
  presentStudents: number;
  absentStudents: number;
  attendanceRate: number;
}> {
  try {
    const sheets = await getGoogleSheetsClient();
    const { spreadsheetId, activeSheetTitle } = await getSpreadsheetConfig();
    const { mapping, indexMap } = await resolveMapping(spreadsheetId, activeSheetTitle);
    const attIdx = indexMap.get(mapping.attendanceHeader) ?? 0;
    const qrIdx = indexMap.get(mapping.qrHeader) ?? 0;
    const attCol = colIndexToA1(attIdx);
    const qrCol = colIndexToA1(qrIdx);
    const resp = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [
        `${activeSheetTitle}!${qrCol}2:${qrCol}1000`,
        `${activeSheetTitle}!${attCol}2:${attCol}1000`,
      ],
    });
    const a = (resp.data.valueRanges?.[0]?.values as string[][]) || [];
    const k = (resp.data.valueRanges?.[1]?.values as string[][]) || [];
    const totalStudents = a.length;
    const presentStudents = k.reduce((acc, r) => acc + (((r?.[0] || "").toString().trim().toLowerCase() === "present") ? 1 : 0), 0);
    const absentStudents = totalStudents - presentStudents;
    const attendanceRate = totalStudents > 0 ? Math.round((presentStudents / totalStudents) * 100) : 0;
    return {
      totalStudents,
      presentStudents,
      absentStudents,
      attendanceRate,
    };
  } catch (error) {
    console.error("[] Error getting attendance stats:", error);
    return {
      totalStudents: 0,
      presentStudents: 0,
      absentStudents: 0,
      attendanceRate: 0,
    };
  }
}

// Get recent attendance logs
export async function getRecentLogs(limit = 10): Promise<AttendanceLog[]> {
  try {
    const sheets = await getGoogleSheetsClient();
    const { spreadsheetId } = await getSpreadsheetConfig();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Logs!A2:F1000",
    });

    const rows = response.data.values || [];

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
      .reverse();
  } catch (error) {
    console.error("[] Error fetching recent logs:", error);
    return [];
  }
}
