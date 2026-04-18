// app/api/payment/add-member-order/route.ts
// Creates an HDFC payment order for adding one member to a per-person-priced team registration.
import { connectDB } from "@/lib/db";
import { Registration, User } from "@/models";
import { createHdfcOrder } from "@/lib/hdfc";
import { requireAuth, unauthorizedResponse } from "@/lib/auth-helpers";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
    if (!await checkRateLimit(`add-member-order:${getClientIp(req)}`, 10, 10 * 60 * 1000)) {
        return rateLimitResponse(60);
    }

    try {
        const session = await requireAuth();

        const body = await req.json();
        const { registrationId, memberName, memberEmail } = body;

        if (!registrationId || !memberName || !memberEmail) {
            return Response.json({ success: false, error: "Missing required fields." }, { status: 400 });
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

        const event = reg.eventId as any;

        if (!event.pricePerPerson || event.price === 0) {
            return Response.json({ success: false, error: "Payment not required for this event." }, { status: 400 });
        }

        const maxTeammates = (event.teamSize?.max ?? 5) - 1;
        if (reg.teamMembers.length >= maxTeammates) {
            return Response.json({ success: false, error: "Team is already at maximum size." }, { status: 400 });
        }

        const normalizedEmail = (memberEmail as string).toLowerCase().trim();
        const leaderUser = await User.findById(session.user.id).select("name email").lean();
        if ((leaderUser as any)?.email === normalizedEmail) {
            return Response.json({ success: false, error: "You cannot add yourself as a team member." }, { status: 400 });
        }
        const alreadyInTeam = reg.teamMembers.some((m: any) => m.email === normalizedEmail);
        if (alreadyInTeam) {
            return Response.json({ success: false, error: "This person is already in your team." }, { status: 400 });
        }

        const orderId = `vigadd_${session.user.id.toString().slice(-8)}_${Date.now().toString(36)}`;

        const reqOrigin =
            req.headers.get("origin") ??
            (() => {
                const h = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
                const proto = req.headers.get("x-forwarded-proto") ?? "https";
                return h ? `${proto}://${h}` : (process.env.NEXT_PUBLIC_APP_URL ?? "");
            })();
        const returnUrl = `${reqOrigin}/api/payment/hdfc-return`;

        const order = await createHdfcOrder({
            orderId,
            amount: event.price,
            customerId: session.user.id,
            customerEmail: (leaderUser as any)?.email ?? "noreply@vigyanrang.in",
            returnUrl,
            orderNote: `Add member to ${event.title}`,
        });

        return Response.json({
            success: true,
            data: {
                orderId: order.order_id,
                paymentLink: order.payment_link,
                amount: event.price,
            },
        });
    } catch (err: any) {
        if (err.message === "UNAUTHORIZED") return unauthorizedResponse();
        console.error("[payment/add-member-order]", err);
        return Response.json({ success: false, error: "Failed to create payment order. Please try again." }, { status: 500 });
    }
}
