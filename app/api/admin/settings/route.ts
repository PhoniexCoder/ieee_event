import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import clientPromise from "@/lib/mongodb";

// Configuration for the settings document
const SETTINGS_COLLECTION = "settings";
const SETTINGS_DOC_FILTER = { type: "event_config" };

// GET: Fetch current event settings
export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session || (session as any).user?.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const client = await clientPromise;
        const dbName = process.env.MONGODB_DB_NAME || "ieee_attendance";
        const db = client.db(dbName);

        const settings = await db.collection(SETTINGS_COLLECTION).findOne(SETTINGS_DOC_FILTER);

        // Return settings or defaults from env if not set in DB
        return NextResponse.json({
            eventName: settings?.eventName || process.env.EVENT_NAME || "IEEE Event",
            eventVenue: settings?.eventVenue || process.env.EVENT_VENUE || "",
            eventDate: settings?.eventDate || process.env.EVENT_DATE || "",
            eventTime: settings?.eventTime || process.env.EVENT_TIME || "",
        });
    } catch (error: any) {
        console.error("[settings] GET error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT: Update event settings
export async function PUT(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || (session as any).user?.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { eventName, eventVenue, eventDate, eventTime } = body;

        const client = await clientPromise;
        const dbName = process.env.MONGODB_DB_NAME || "ieee_attendance";
        const db = client.db(dbName);

        // Upsert the settings
        await db.collection(SETTINGS_COLLECTION).updateOne(
            SETTINGS_DOC_FILTER,
            {
                $set: {
                    type: "event_config", // ensure type is set on insert
                    eventName,
                    eventVenue,
                    eventDate,
                    eventTime,
                    updatedAt: new Date(),
                    updatedBy: session.user?.email
                }
            },
            { upsert: true }
        );

        return NextResponse.json({ success: true, message: "Settings updated successfully" });
    } catch (error: any) {
        console.error("[settings] PUT error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
