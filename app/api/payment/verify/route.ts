// app/api/payment/verify/route.ts
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { Event, Registration, Ticket, User } from "@/models";
import { requireAuth, unauthorizedResponse } from "@/lib/auth-helpers";
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
    try {
        const session = await requireAuth();

        const body = await req.json();
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            eventId,
            teamMembers = [],
            formResponses = [],
        } = body;

        // ── 1. Validate required payment fields ────────────────────────────────
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return Response.json(
                { success: false, error: "Missing payment verification fields." },
                { status: 400 }
            );
        }

        // ── 2. Verify HMAC signature ───────────────────────────────────────────
        // Razorpay signs: sha256(order_id + "|" + payment_id) with key_secret
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            console.error("[payment/verify] Signature mismatch");
            return Response.json(
                { success: false, error: "Payment verification failed. Invalid signature." },
                { status: 400 }
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

        await connectDB();

        // ── 4. Re-validate event (capacity may have changed during checkout) ───
        const event = await Event.findById(parsed.data.eventId);

        if (!event) {
            return Response.json(
                { success: false, error: "Event not found." },
                { status: 404 }
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

        const registration = await Registration.create({
            eventId: parsed.data.eventId,
            userId: session.user.id,
            formResponses: parsed.data.formResponses,
            isTeamRegistration: isTeam,
            teamMembers: isTeam ? parsed.data.teamMembers : [],
            teamId,
            paymentId: razorpay_payment_id,
            paymentStatus: "completed",
            status: "confirmed",
        });

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
                    userId: memberUser?._id ?? undefined,
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
                error: "Something went wrong confirming your payment. Please contact support with your payment ID.",
            },
            { status: 500 }
        );
    }
}