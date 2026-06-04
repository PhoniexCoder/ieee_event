import { NextResponse } from "next/server"

export class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = "ApiError";
  }
}

export function handleApiError(error: unknown, context: string) {
  if (error instanceof ApiError) {
    console.warn(`[API ${context}] Client error: ${error.message} (${error.statusCode})`);
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }
  console.error(`[API ${context}] Unhandled error:`, error)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}
