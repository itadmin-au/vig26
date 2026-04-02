// app/api/payment/webhook/route.ts
// Cashfree server-to-server webhook — receives authoritative payment status updates.
// Signature: HMAC-SHA256(secretKey, timestamp + rawBody), base64-encoded.
// Docs: https://docs.cashfree.com/docs/payment-gateway-webhooks

import { connectDB } from "@/lib/db";
import { Event, Registration } from "@/models";
import { verifyCashfreeWebhook } from "@/lib/cashfree";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET() {
    return Response.json({ success: true, message: "Cashfree webhook endpoint is reachable." });
}

// Cashfree retries webhooks; always return 200 so they stop retrying once processed.
export async function POST(req: Request) {
    // Rate limit: 200 webhook calls per minute from any single IP (Cashfree uses a fixed IP range)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!await checkRateLimit(`webhook:${ip}`, 200, 60 * 1000)) {
        return rateLimitResponse(60);
    }

    // Read raw body first — needed for signature verification
    const rawBody = await req.text();

    const timestamp = req.headers.get("x-webhook-timestamp") ?? "";
    const signature = req.headers.get("x-webhook-signature") ?? "";

    if (!timestamp || !signature) {
        console.error("[webhook] Missing Cashfree signature headers");
        return Response.json({ error: "Missing signature" }, { status: 400 });
    }

    // Reject stale or future-dated webhooks to prevent replay attacks.
    // Cashfree sends x-webhook-timestamp as a Unix epoch in seconds.
    const tsSeconds = parseInt(timestamp, 10);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (isNaN(tsSeconds) || Math.abs(nowSeconds - tsSeconds) > 300) {
        console.error("[webhook] Timestamp out of acceptable window:", timestamp);
        return Response.json({ error: "Webhook timestamp invalid or expired" }, { status: 400 });
    }

    if (!verifyCashfreeWebhook(rawBody, timestamp, signature)) {
        console.error("[webhook] Invalid Cashfree webhook signature");
        return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: any;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const eventType: string = payload?.type ?? "";
    const data = payload?.data ?? {};

    try {
        await connectDB();

        if (eventType === "PAYMENT_SUCCESS_WEBHOOK") {
            const orderId: string = data?.order?.order_id ?? "";
            const cfPaymentId: string = String(data?.payment?.cf_payment_id ?? "");
            const paidAmount: number = data?.payment?.payment_amount ?? 0;

            if (!orderId || !cfPaymentId) {
                console.error("[webhook] Missing orderId or cfPaymentId");
                return Response.json({ success: true }); // 200 so Cashfree stops retrying
            }

            // ── Idempotency: skip if already processed ────────────────────────
            const existingReg = await Registration.findOne({
                paymentId: orderId,
                paymentStatus: "completed",
            });

            if (existingReg) {
                console.log("[webhook] Already processed order:", orderId);
                return Response.json({ success: true, message: "Already processed" });
            }

            // ── Find pending registration by orderId ──────────────────────────
            // Registration may have been created in the optimistic client flow or
            // may be absent (webhook-first scenario). Handle both.
            const reg = await Registration.findOne({ paymentId: orderId });

            if (reg) {
                // Validate paid amount matches event price
                const event = await Event.findById(reg.eventId).lean();
                if (event && paidAmount < (event as any).price) {
                    console.error(
                        `[webhook] Underpayment for order ${orderId}: paid ${paidAmount}, expected ${(event as any).price}`
                    );
                    // Do NOT mark as completed; flag for manual review
                    reg.paymentStatus = "failed";
                    await reg.save();
                    return Response.json({ success: true });
                }

                reg.paymentStatus = "completed";
                reg.status = "confirmed";
                await reg.save();
                console.log("[webhook] Payment confirmed for order:", orderId);
            } else {
                console.warn("[webhook] No registration found for order:", orderId);
            }

            return Response.json({ success: true });
        }

        if (eventType === "PAYMENT_FAILED_WEBHOOK") {
            const orderId: string = data?.order?.order_id ?? "";
            if (orderId) {
                await Registration.findOneAndUpdate(
                    { paymentId: orderId, paymentStatus: { $ne: "completed" } },
                    { paymentStatus: "failed" }
                );
            }
            return Response.json({ success: true });
        }

        // Unknown event type — acknowledge to prevent retries
        return Response.json({ success: true });
    } catch (err) {
        console.error("[webhook] Processing error:", err);
        // Return 500 so Cashfree will retry (transient DB errors etc.)
        return Response.json({ error: "Processing failed" }, { status: 500 });
    }
}
