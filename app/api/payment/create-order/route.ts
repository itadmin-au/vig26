// app/api/payment/create-order/route.ts
import { connectDB } from "@/lib/db";
import { Event, Registration, User } from "@/models";
import { createCashfreeOrder } from "@/lib/cashfree";
import { requireAuth, unauthorizedResponse } from "@/lib/auth-helpers";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
    // 20 order-creation attempts per IP per 10 minutes
    if (!await checkRateLimit(`create-order:${getClientIp(req)}`, 20, 10 * 60 * 1000)) {
        return rateLimitResponse(60);
    }

    try {
        const session = await requireAuth();

        const body = await req.json();
        const { eventId } = body;

        if (!eventId || typeof eventId !== "string") {
            return Response.json(
                { success: false, error: "eventId is required." },
                { status: 400 }
            );
        }

        await connectDB();

        // ── Validate event ─────────────────────────────────────────────────────
        const event = await Event.findById(eventId).lean();

        if (!event) {
            return Response.json(
                { success: false, error: "Event not found." },
                { status: 404 }
            );
        }

        if (event.status !== "published") {
            return Response.json(
                { success: false, error: "This event is not open for registration." },
                { status: 400 }
            );
        }

        if (event.price === 0) {
            return Response.json(
                { success: false, error: "This event is free. No payment required." },
                { status: 400 }
            );
        }

        // ── Capacity check ─────────────────────────────────────────────────────
        if (event.capacity > 0 && event.registrationCount >= event.capacity) {
            return Response.json(
                { success: false, error: "This event is fully booked." },
                { status: 400 }
            );
        }

        // ── Duplicate registration check ───────────────────────────────────────
        const existing = await Registration.findOne({
            eventId,
            userId: session.user.id,
        }).lean();

        if (existing) {
            return Response.json(
                { success: false, error: "You are already registered for this event." },
                { status: 400 }
            );
        }

        // ── Fetch user details needed by Cashfree ──────────────────────────────
        const user = await User.findById(session.user.id).select("name email").lean();

        // ── Create Cashfree order ──────────────────────────────────────────────
        // Order ID: unique per attempt (timestamp suffix handles retries)
        const orderId = `vig_${session.user.id.toString().slice(-10)}_${Date.now().toString(36)}`;

        const order = await createCashfreeOrder({
            orderId,
            amount: event.price,
            customerId: session.user.id,
            customerName: (user as any)?.name ?? "Customer",
            customerEmail: (user as any)?.email ?? "noreply@vigyanrang.in",
            orderNote: event.title,
        });

        return Response.json({
            success: true,
            data: {
                orderId: order.order_id,
                paymentSessionId: order.payment_session_id,
                amount: event.price,
            },
        });
    } catch (err: any) {
        if (err.message === "UNAUTHORIZED") {
            return unauthorizedResponse();
        }
        console.error("[payment/create-order]", err);
        return Response.json(
            { success: false, error: "Failed to create payment order. Please try again." },
            { status: 500 }
        );
    }
}
