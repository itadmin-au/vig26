// app/api/payment/verify/route.ts
import { connectDB } from "@/lib/db";
import { Event, Registration, Ticket, User } from "@/models";
import { getCashfreeOrder } from "@/lib/cashfree";
import { requireAuth, unauthorizedResponse } from "@/lib/auth-helpers";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import {
    generateQRToken,
    generateTeamId,
    serialize,
    formatEventDate,
} from "@/lib/utils";
import {
    sendTicketConfirmationEmail,
    sendTeamMemberInviteEmail,
} from "@/lib/email";
import { createRegistrationSchema } from "@/lib/validations";

export async function POST(req: Request) {
    // 30 verify attempts per IP per 10 minutes
    if (!await checkRateLimit(`verify:${getClientIp(req)}`, 30, 10 * 60 * 1000)) {
        return rateLimitResponse(60);
    }

    try {
        const session = await requireAuth();

        const body = await req.json();
        const {
            orderId,
            eventId,
            teamMembers = [],
            formResponses = [],
        } = body;

        // ── 1. Validate required payment fields ────────────────────────────────
        if (!orderId || typeof orderId !== "string") {
            return Response.json(
                { success: false, error: "Missing payment order ID." },
                { status: 400 }
            );
        }

        // ── 2. Verify payment with Cashfree ────────────────────────────────────
        const cfOrder = await getCashfreeOrder(orderId) as any;

        if (cfOrder.order_status !== "PAID") {
            console.error("[payment/verify] Cashfree order not paid:", cfOrder.order_status);
            return Response.json(
                { success: false, error: "Payment not completed. Please try again." },
                { status: 400 }
            );
        }

        // ── 2a. Idempotency: return early if this order was already processed ──
        await connectDB();
        const alreadyProcessed = await Registration.findOne({
            paymentId: orderId,
            paymentStatus: "completed",
        });
        if (alreadyProcessed) {
            return Response.json(
                {
                    success: true,
                    data: { registration: alreadyProcessed.toObject(), ticketCount: 1 },
                },
            );
        }

        // ── 3. Validate registration input schema ──────────────────────────────
        const parsed = createRegistrationSchema.safeParse({
            eventId,
            teamMembers,
            formResponses,
        });

        if (!parsed.success) {
            return Response.json(
                { success: false, error: parsed.error.issues[0].message },
                { status: 400 }
            );
        }

        // ── 4. Re-validate event (capacity may have changed during checkout) ───
        const event = await Event.findById(parsed.data.eventId);

        if (!event) {
            return Response.json(
                { success: false, error: "Event not found." },
                { status: 404 }
            );
        }

        // ── 4a. Verify paid amount matches event price (prevent underpayment) ─
        const paidAmount: number = cfOrder.order_amount ?? 0;
        if (paidAmount < event.price) {
            console.error(
                `[payment/verify] Underpayment: paid ${paidAmount}, expected ${event.price} for order ${orderId}`
            );
            return Response.json(
                { success: false, error: "Payment amount mismatch. Please contact support." },
                { status: 400 }
            );
        }

        if (event.status !== "published") {
            return Response.json(
                { success: false, error: "This event is no longer accepting registrations." },
                { status: 400 }
            );
        }

        if (event.capacity > 0 && event.registrationCount >= event.capacity) {
            return Response.json(
                {
                    success: false,
                    error: "Unfortunately this event is now fully booked. Please contact the organiser for a refund.",
                },
                { status: 400 }
            );
        }

        // ── 5. Guard against duplicate registration ────────────────────────────
        const existingReg = await Registration.findOne({
            eventId: parsed.data.eventId,
            userId: session.user.id,
        });

        if (existingReg) {
            return Response.json(
                { success: false, error: "You are already registered for this event." },
                { status: 400 }
            );
        }

        // ── 6. Create Registration ─────────────────────────────────────────────
        const isTeam =
            event.isTeamEvent && parsed.data.teamMembers.length > 0;
        const teamId = isTeam ? generateTeamId() : undefined;

        let registration;
        try {
            registration = await Registration.create({
                eventId: parsed.data.eventId,
                userId: session.user.id,
                formResponses: parsed.data.formResponses,
                isTeamRegistration: isTeam,
                teamMembers: isTeam ? parsed.data.teamMembers : [],
                teamId,
                paymentId: orderId,
                paymentStatus: "completed",
                status: "confirmed",
            });
        } catch (createErr: any) {
            // Duplicate key error — a concurrent request already created this registration.
            // Return the existing one rather than failing or creating a duplicate.
            if (createErr.code === 11000) {
                const existing = await Registration.findOne({ paymentId: orderId });
                if (existing) {
                    return Response.json({
                        success: true,
                        data: { registration: serialize(existing.toObject()), ticketCount: 1 },
                    });
                }
            }
            throw createErr;
        }

        // ── 7. Create tickets and send emails ──────────────────────────────────
        const leaderQR = generateQRToken();

        await Ticket.create({
            registrationId: registration._id,
            eventId: parsed.data.eventId,
            userId: session.user.id,
            qrCode: leaderQR,
            teamRole: isTeam ? "leader" : "solo",
            teamId,
            attendanceStatus: false,
        });

        let ticketCount = 1;

        const leaderUser = await User.findById(session.user.id);
        if (leaderUser) {
            await sendTicketConfirmationEmail({
                to: leaderUser.email,
                name: leaderUser.name,
                eventTitle: event.title,
                eventDate: formatEventDate(event.date.start, event.date.end),
                venue: event.venue ?? undefined,
                ticketId: leaderQR,
            });

            await User.findByIdAndUpdate(session.user.id, {
                $addToSet: { registeredEvents: registration._id },
            });
        }

        // ── Team members ───────────────────────────────────────────────────────
        if (isTeam) {
            for (const member of parsed.data.teamMembers) {
                const memberUser = await User.findOne({ email: member.email });
                const memberQR = generateQRToken();

                await Ticket.create({
                    registrationId: registration._id,
                    eventId: parsed.data.eventId,
                    ...(memberUser ? { userId: memberUser._id } : {}),
                    qrCode: memberQR,
                    teamRole: "member",
                    teamId,
                    attendanceStatus: false,
                });

                ticketCount++;

                if (memberUser) {
                    await sendTicketConfirmationEmail({
                        to: memberUser.email,
                        name: memberUser.name,
                        eventTitle: event.title,
                        eventDate: formatEventDate(
                            event.date.start,
                            event.date.end
                        ),
                        venue: event.venue ?? undefined,
                        ticketId: memberQR,
                    });
                    await User.findByIdAndUpdate(memberUser._id, {
                        $addToSet: { registeredEvents: registration._id },
                    });
                } else {
                    await sendTeamMemberInviteEmail({
                        to: member.email,
                        memberName: member.name,
                        leaderName: session.user.name ?? "Your team leader",
                        eventTitle: event.title,
                    });
                }
            }
        }

        return Response.json(
            {
                success: true,
                data: {
                    registration: serialize(registration),
                    ticketCount,
                },
            },
            { status: 201 }
        );
    } catch (err: any) {
        if (err.message === "UNAUTHORIZED") {
            return unauthorizedResponse();
        }
        console.error("[payment/verify]", err);
        return Response.json(
            {
                success: false,
                error: "Something went wrong confirming your payment. Please contact support with your order ID.",
            },
            { status: 500 }
        );
    }
}
