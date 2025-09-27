// Deprecated: This endpoint has been replaced by /api/admin/spreadsheet.
// Returning 410 Gone to avoid duplicate configuration paths in production.
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { message: 'This endpoint is deprecated. Use /api/admin/spreadsheet instead.' },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    { message: 'This endpoint is deprecated. Use /api/admin/spreadsheet instead.' },
    { status: 410 }
  );
}
