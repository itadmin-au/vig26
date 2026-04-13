// app/api/admin/cancel-ticket/route.ts
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Registration, Ticket } from "@/models";
import { requireSuperAdmin, forbiddenResponse, unauthorizedResponse } from "@/lib/auth-helpers";

// ── GET: look up ticket/registration by ticket ID (qrCode or ticketId ObjectId) ─

export async function GET(req: Request) {
    try {
        await requireSuperAdmin();
    } catch (err: any) {
        if (err.message === "UNAUTHORIZED") return unauthorizedResponse();
        return forbiddenResponse();
    }

    try {
        const { searchParams } = new URL(req.url);
        const ticketId = searchParams.get("ticketId")?.trim();

        if (!ticketId) {
            return Response.json(
                { success: false, error: "Missing ticketId query param." },
                { status: 400 }
            );
        }

        await connectDB();

        // Try by qrCode first, then by ObjectId
        let ticket: any = await Ticket.findOne({ qrCode: ticketId }).populate("userId", "name email");

        if (!ticket && mongoose.isValidObjectId(ticketId)) {
            ticket = await Ticket.findById(ticketId).populate("userId", "name email");
        }

        if (!ticket) {
            return Response.json(
                { success: false, error: `No ticket found for: ${ticketId}` },
                { status: 404 }
            );
        }

        const registration: any = await Registration.findById(ticket.registrationId)
            .populate("userId", "name email collegeId")
            .populate("eventId", "title date venue price");

        if (!registration) {
            return Response.json(
                { success: false, error: "Registration linked to this ticket was not found." },
                { status: 404 }
            );
        }

        const allTickets = await Ticket.find({ registrationId: registration._id }).populate("userId", "name email");

        return Response.json({
            success: true,
            data: {
                ticketId: ticket._id.toString(),
                qrCode: ticket.qrCode,
                teamRole: ticket.teamRole,
                attendanceStatus: ticket.attendanceStatus,
                recipientName: (ticket.userId as any)?.name ?? null,
                recipientEmail: (ticket.userId as any)?.email ?? null,
                registration: {
                    registrationId: registration._id.toString(),
                    paymentId: registration.paymentId ?? null,
                    status: registration.status,
                    paymentStatus: registration.paymentStatus,
                    event: {
                        title: (registration.eventId as any)?.title ?? "—",
                    },
                    registrant: {
                        name: (registration.userId as any)?.name ?? null,
                        email: (registration.userId as any)?.email ?? null,
                        collegeId: (registration.userId as any)?.collegeId ?? null,
                    },
                    ticketCount: allTickets.length,
                },
            },
        });
    } catch (err: any) {
        console.error("[admin/cancel-ticket GET]", err);
        return Response.json({ success: false, error: "Internal server error." }, { status: 500 });
    }
}

// ── POST: cancel the registration associated with the ticket ──────────────────

export async function POST(req: Request) {
    try {
        await requireSuperAdmin();
    } catch (err: any) {
        if (err.message === "UNAUTHORIZED") return unauthorizedResponse();
        return forbiddenResponse();
    }

    try {
        const { ticketId } = await req.json();

        if (!ticketId || typeof ticketId !== "string") {
            return Response.json(
                { success: false, error: "Missing ticketId." },
                { status: 400 }
            );
        }

        await connectDB();

        let ticket: any = await Ticket.findOne({ qrCode: ticketId.trim() });

        if (!ticket && mongoose.isValidObjectId(ticketId.trim())) {
            ticket = await Ticket.findById(ticketId.trim());
        }

        if (!ticket) {
            return Response.json(
                { success: false, error: `No ticket found for: ${ticketId}` },
                { status: 404 }
            );
        }

        const registration: any = await Registration.findById(ticket.registrationId).populate("eventId", "title");

        if (!registration) {
            return Response.json(
                { success: false, error: "Registration linked to this ticket was not found." },
                { status: 404 }
            );
        }

        if (registration.status === "cancelled") {
            return Response.json(
                { success: false, error: "Registration is already cancelled." },
                { status: 400 }
            );
        }

        await Registration.findByIdAndUpdate(registration._id, { status: "cancelled" }, { new: true });

        return Response.json({
            success: true,
            data: {
                registrationId: registration._id.toString(),
                eventTitle: (registration.eventId as any)?.title ?? "—",
                cancelledAt: new Date().toISOString(),
            },
        });
    } catch (err: any) {
        console.error("[admin/cancel-ticket POST]", err);
        return Response.json({ success: false, error: "Internal server error." }, { status: 500 });
    }
}
