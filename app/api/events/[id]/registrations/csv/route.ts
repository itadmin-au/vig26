// app/api/events/[id]/registrations/csv/route.ts
// Public CSV feed — protected by a per-event secret token.
// Usage in Google Sheets: =IMPORTDATA("https://yourdomain.com/api/events/ID/registrations/csv?token=TOKEN")
// Google Sheets re-fetches IMPORTDATA every ~1 hour automatically.

import { connectDB } from "@/lib/db";
import { Event, Registration } from "@/models";
import { NextRequest } from "next/server";

function toCSV(rows: string[][]): string {
    return rows
        .map((row) =>
            row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
        )
        .join("\r\n");
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
        return new Response("Missing token", { status: 401 });
    }

    await connectDB();

    const event = await Event.findById(id).lean();

    if (!event) {
        return new Response("Event not found", { status: 404 });
    }

    if (!(event as any).csvToken || (event as any).csvToken !== token) {
        return new Response("Invalid token", { status: 403 });
    }

    const registrations = await Registration.find({ eventId: id, status: "confirmed" })
        .populate("userId", "name email collegeId")
        .sort({ createdAt: -1 })
        .lean();

    const customFields = (event as any).customForm ?? [];

    const headers = [
        "Registration ID",
        "Name",
        "Email",
        "College ID",
        "Type",
        "Team ID",
        "Payment Status",
        "Registered At",
        ...customFields.map((f: any) => f.label),
    ];

    const rows: string[][] = [headers];

    for (const reg of registrations) {
        const responseMap: Record<string, string> = {};
        for (const r of (reg as any).formResponses ?? []) {
            responseMap[r.fieldId] = String(r.value ?? "");
        }

        const userId = (reg as any).userId;
        rows.push([
            String(reg._id),
            userId?.name ?? "—",
            userId?.email ?? "—",
            userId?.collegeId ?? "—",
            (reg as any).isTeamRegistration ? "Team" : "Individual",
            (reg as any).teamId ?? "—",
            (reg as any).paymentStatus,
            new Date(reg.createdAt as Date).toLocaleString("en-IN"),
            ...customFields.map((f: any) => responseMap[String(f._id)] ?? ""),
        ]);
    }

    return new Response(toCSV(rows), {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Cache-Control": "no-store",
        },
    });
}
