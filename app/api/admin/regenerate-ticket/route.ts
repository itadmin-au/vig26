// app/api/admin/regenerate-ticket/route.ts
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Event, Registration, Ticket, User } from "@/models";
import { requireSuperAdmin, forbiddenResponse, unauthorizedResponse } from "@/lib/auth-helpers";
import { sendTicketConfirmationEmail } from "@/lib/email";
import { formatEventDate } from "@/lib/utils";

// ── GET: preview registration details before sending ──────────────────────────

export async function GET(req: Request) {
    try {
        await requireSuperAdmin();
    } catch (err: any) {
        if (err.message === "UNAUTHORIZED") return unauthorizedResponse();
        return forbiddenResponse();
    }

    try {
        const { searchParams } = new URL(req.url);
        const identifier = searchParams.get("identifier")?.trim();

        if (!identifier) {
            return Response.json(
                { success: false, error: "Missing identifier query param." },
                { status: 400 }
            );
        }

        await connectDB();

        let registration: any = await Registration.findOne({ paymentId: identifier })
            .populate("userId", "name email collegeId")
            .populate("eventId", "title date venue price isTeamEvent");

        if (!registration && mongoose.isValidObjectId(identifier)) {
            registration = await Registration.findById(identifier)
                .populate("userId", "name email collegeId")
                .populate("eventId", "title date venue price isTeamEvent");
        }

        if (!registration) {
            const ticketByQr = await Ticket.findOne({ qrCode: identifier });
            if (ticketByQr) {
                registration = await Registration.findById(ticketByQr.registrationId)
                    .populate("userId", "name email collegeId")
                    .populate("eventId", "title date venue price isTeamEvent");
            }
        }

        if (!registration) {
            return Response.json(
                { success: false, error: `No registration found for: ${identifier}` },
                { status: 404 }
            );
        }

        const tickets = await Ticket.find({ registrationId: registration._id })
            .populate("userId", "name email");

        const event = registration.eventId as any;

        return Response.json({
            success: true,
            data: {
                registrationId: registration._id.toString(),
                paymentId: registration.paymentId ?? null,
                status: registration.status,
                paymentStatus: registration.paymentStatus,
                createdAt: registration.createdAt,
                event: {
                    title: event.title,
                    date: formatEventDate(event.date.start, event.date.end),
                    venue: event.venue ?? null,
                    price: event.price,
                },
                registrant: {
                    name: (registration.userId as any)?.name ?? null,
                    email: (registration.userId as any)?.email ?? null,
                    collegeId: (registration.userId as any)?.collegeId ?? null,
                },
                tickets: tickets.map((t: any) => ({
                    ticketId: t._id.toString(),
                    qrCode: t.qrCode,
                    teamRole: t.teamRole,
                    attendanceStatus: t.attendanceStatus,
                    recipientName: (t.userId as any)?.name ?? null,
                    recipientEmail: (t.userId as any)?.email ?? null,
                })),
            },
        });
    } catch (err: any) {
        console.error("[admin/regenerate-ticket GET]", err);
        return Response.json({ success: false, error: "Internal server error." }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await requireSuperAdmin();
    } catch (err: any) {
        if (err.message === "UNAUTHORIZED") return unauthorizedResponse();
        return forbiddenResponse();
    }

    try {
        const { identifier, userOverrides } = await req.json();

        if (!identifier || typeof identifier !== "string") {
            return Response.json(
                { success: false, error: "Missing identifier (paymentId or registrationId)." },
                { status: 400 }
            );
        }

        // userOverrides: { ticketId: string, email: string }[]
        const overrideMap: Record<string, string> = {};
        if (Array.isArray(userOverrides)) {
            for (const o of userOverrides) {
                if (o.ticketId && o.email) overrideMap[o.ticketId] = o.email.trim().toLowerCase();
            }
        }

        await connectDB();

        // Try to find registration by paymentId first, then by _id
        let registration: any = await Registration.findOne({ paymentId: identifier.trim() }).populate("userId eventId");

        if (!registration && mongoose.isValidObjectId(identifier.trim())) {
            registration = await Registration.findById(identifier.trim()).populate("userId eventId");
        }

        if (!registration) {
            const ticketByQr = await Ticket.findOne({ qrCode: identifier.trim() });
            if (ticketByQr) {
                registration = await Registration.findById(ticketByQr.registrationId).populate("userId eventId");
            }
        }

        if (!registration) {
            return Response.json(
                { success: false, error: `No registration found for identifier: ${identifier}` },
                { status: 404 }
            );
        }

        if (registration.status !== "confirmed") {
            return Response.json(
                {
                    success: false,
                    error: `Registration status is "${registration.status}" — only confirmed registrations can have tickets regenerated.`,
                },
                { status: 400 }
            );
        }

        // Fetch all tickets for this registration
        const tickets = await Ticket.find({ registrationId: registration._id }).populate("userId");

        if (tickets.length === 0) {
            return Response.json(
                { success: false, error: "No tickets found for this registration. Tickets may not have been created." },
                { status: 404 }
            );
        }

        const event = registration.eventId;
        const eventDate = formatEventDate(event.date.start, event.date.end);

        const results: Array<{ email: string; status: "sent" | "failed"; error?: string }> = [];

        for (const ticket of tickets) {
            const ticketId = ticket._id.toString();
            let user = ticket.userId as any;

            // If an override email was provided for this ticket, look up or use the user
            if (overrideMap[ticketId]) {
                const overrideEmail = overrideMap[ticketId];
                const foundUser = await User.findOne({ email: overrideEmail });
                if (foundUser) {
                    await Ticket.findByIdAndUpdate(ticket._id, { userId: foundUser._id });
                    user = foundUser;
                } else {
                    // User not in system — send to the provided email directly without linking
                    user = { email: overrideEmail, name: overrideEmail };
                }
            }

            if (!user?.email) {
                results.push({ email: "(unknown)", status: "failed", error: "No user linked to ticket" });
                continue;
            }

            try {
                await sendTicketConfirmationEmail({
                    to: user.email,
                    name: user.name ?? user.email,
                    eventTitle: event.title,
                    eventDate,
                    venue: event.venue ?? undefined,
                    ticketId: ticket.qrCode,
                });
                results.push({ email: user.email, status: "sent" });
            } catch (emailErr: any) {
                results.push({ email: user.email, status: "failed", error: emailErr.message });
            }
        }

        const sentCount = results.filter((r) => r.status === "sent").length;

        return Response.json({
            success: true,
            data: {
                registrationId: registration._id.toString(),
                paymentId: registration.paymentId,
                eventTitle: event.title,
                ticketsFound: tickets.length,
                emailsSent: sentCount,
                results,
            },
        });
    } catch (err: any) {
        console.error("[admin/regenerate-ticket]", err);
        return Response.json(
            { success: false, error: "Internal server error." },
            { status: 500 }
        );
    }
}
