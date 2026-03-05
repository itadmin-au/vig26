// app/api/payment/create-order/route.ts
import { connectDB } from "@/lib/db";
import { Event, Registration } from "@/models";
import { getRazorpay } from "@/lib/razorpay";
import { requireAuth, unauthorizedResponse } from "@/lib/auth-helpers";

export async function POST(req: Request) {
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

        // ── Create Razorpay order ──────────────────────────────────────────────
        const razorpay = getRazorpay();

        const order = await razorpay.orders.create({
            amount: event.price * 100, // convert ₹ to paise
            currency: "INR",
            receipt: `${session.user.id}_${eventId}`.slice(0, 40),
            notes: {
                eventId: eventId,
                userId: session.user.id,
                eventTitle: event.title,
            },
        });

        return Response.json({
            success: true,
            data: {
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                keyId: process.env.RAZORPAY_KEY_ID,
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