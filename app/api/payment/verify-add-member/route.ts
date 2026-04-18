// app/api/payment/verify-add-member/route.ts
// Verifies HDFC payment and adds a new member to an existing confirmed team registration.
import { connectDB } from "@/lib/db";
import { Registration, Ticket, User } from "@/models";
import { getHdfcOrderStatus, isHdfcPaid } from "@/lib/hdfc";
import { requireAuth, unauthorizedResponse } from "@/lib/auth-helpers";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { generateQRToken, formatEventDate } from "@/lib/utils";
import { sendTicketConfirmationEmail, sendTeamMemberInviteEmail } from "@/lib/email";

export async function POST(req: Request) {
    if (!await checkRateLimit(`verify-add-member:${getClientIp(req)}`, 20, 10 * 60 * 1000)) {
        return rateLimitResponse(60);
    }

    try {
        const session = await requireAuth();

        const body = await req.json();
        const { orderId, registrationId, memberName, memberEmail, memberUsn } = body;

        if (!orderId || !registrationId || !memberName || !memberEmail) {
            return Response.json({ success: false, error: "Missing required fields." }, { status: 400 });
        }

        // Verify HDFC payment
        const hdfcOrder = await getHdfcOrderStatus(orderId);
        if (!isHdfcPaid(hdfcOrder.status)) {
            return Response.json({ success: false, error: "Payment not completed. Please try again." }, { status: 400 });
        }

        await connectDB();

        const reg = await Registration.findOne({ _id: registrationId, userId: session.user.id })
            .populate("eventId");

        if (!reg) {
            return Response.json({ success: false, error: "Registration not found." }, { status: 404 });
        }
        if (reg.status !== "confirmed") {
            return Response.json({ success: false, error: "Registration is not confirmed." }, { status: 400 });
        }

        // Idempotency: return success if this order was already processed
        if ((reg.addMemberOrderIds ?? []).includes(orderId)) {
            return Response.json({ success: true, data: { alreadyProcessed: true } });
        }

        const normalizedEmail = (memberEmail as string).toLowerCase().trim();
        const event = reg.eventId as any;

        const memberUser = await User.findOne({ email: normalizedEmail });
        const memberQR = generateQRToken();

        await Registration.findByIdAndUpdate(reg._id, {
            $push: {
                teamMembers: { name: memberName, email: normalizedEmail, usn: (memberUsn as string | undefined)?.trim() || null, userId: memberUser?._id ?? null },
                addMemberOrderIds: orderId,
            },
        });

        await Ticket.create({
            registrationId: reg._id,
            eventId: event._id,
            userId: memberUser?._id ?? undefined,
            qrCode: memberQR,
            teamRole: "member",
            teamId: reg.teamId,
            attendanceStatus: false,
        });

        if (memberUser) {
            try {
                const emailDate = formatEventDate(event.date.start, event.date.end);
                await sendTicketConfirmationEmail({
                    to: memberUser.email,
                    name: memberUser.name,
                    eventTitle: event.title,
                    eventDate: emailDate,
                    venue: event.venue ?? undefined,
                    ticketId: memberQR,
                });
            } catch (err: any) {
                console.error("[verify-add-member] ticket email failed:", err?.message);
            }
            await User.findByIdAndUpdate(memberUser._id, { $addToSet: { registeredEvents: reg._id } });
        } else {
            try {
                const leader = await User.findById(session.user.id).lean();
                await sendTeamMemberInviteEmail({
                    to: memberEmail,
                    memberName,
                    leaderName: (leader as any)?.name ?? "Your team leader",
                    eventTitle: event.title,
                });
            } catch (err: any) {
                console.error("[verify-add-member] invite email failed:", err?.message);
            }
        }

        return Response.json({ success: true, data: { memberAdded: true } });
    } catch (err: any) {
        if (err.message === "UNAUTHORIZED") return unauthorizedResponse();
        console.error("[payment/verify-add-member]", err);
        return Response.json({ success: false, error: "Failed to add team member. Please contact support." }, { status: 500 });
    }
}
