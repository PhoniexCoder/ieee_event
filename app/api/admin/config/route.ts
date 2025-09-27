import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import clientPromise from '@/lib/mongodb';

const DB_NAME = process.env.MONGODB_DB_NAME || 'ieee_attendance';
const COLLECTION_NAME = 'settings';

export async function GET(req: NextRequest) {
  const session: any = await getServerSession(authOptions as any);

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const settings = await db.collection(COLLECTION_NAME).findOne({ name: 'spreadsheetId' });

    return NextResponse.json({ spreadsheetId: settings?.value || '' });
  } catch (error) {
    console.error('Error fetching spreadsheet ID:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session: any = await getServerSession(authOptions as any);

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { spreadsheetId } = await req.json();

    if (!spreadsheetId) {
      return NextResponse.json({ message: 'Spreadsheet ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    await db.collection(COLLECTION_NAME).updateOne(
      { name: 'spreadsheetId' },
      { $set: { value: spreadsheetId } },
      { upsert: true }
    );

    return NextResponse.json({ message: 'Spreadsheet ID updated successfully' });
  } catch (error) {
    console.error('Error updating spreadsheet ID:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
