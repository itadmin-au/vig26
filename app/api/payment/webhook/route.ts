// app/api/payment/webhook/route.ts
// Unified payment webhook — handles both Cashfree and HDFC SmartGateway (Juspay).
// Provider is auto-detected from request headers.
//
// Cashfree: HMAC-SHA256(secretKey, timestamp + rawBody), base64-encoded.
//   Headers: x-webhook-timestamp, x-webhook-signature
//
// HDFC/Juspay: HMAC-SHA256(apiKey, rawBody), base64-encoded.
//   Headers: signature  (and optionally x-jp-merchant-id)

import { connectDB } from "@/lib/db";
import { Event, Registration, User } from "@/models";
import { verifyCashfreeWebhook } from "@/lib/cashfree";
import { verifyHdfcWebhook, isHdfcPaid, isHdfcFailed } from "@/lib/hdfc";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET() {
    return Response.json({ success: true, message: "Payment webhook endpoint is reachable." });
}

// Both Cashfree and Juspay retry on non-2xx; always return 200 once processed.
export async function POST(req: Request) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!await checkRateLimit(`webhook:${ip}`, 200, 60 * 1000)) {
        return rateLimitResponse(60);
    }

    // Read raw body first — needed for signature verification
    const rawBody = await req.text();

    // ── Detect provider from headers ──────────────────────────────────────────
    // Cashfree sends x-webhook-timestamp; HDFC/Juspay sends signature (no timestamp)
    const cfTimestamp = req.headers.get("x-webhook-timestamp") ?? "";
    const cfSignature = req.headers.get("x-webhook-signature") ?? "";
    const hdfcSignature = req.headers.get("signature") ?? "";

    const isCashfree = Boolean(cfTimestamp && cfSignature);
    const isHdfc = Boolean(hdfcSignature && !isCashfree);

    if (!isCashfree && !isHdfc) {
        console.error("[webhook] Could not detect payment provider from headers");
        return Response.json({ error: "Missing signature headers" }, { status: 400 });
    }

    // ── Verify signature ──────────────────────────────────────────────────────
    if (isCashfree) {
        // Reject stale or future-dated webhooks to prevent replay attacks.
        // Cashfree sends x-webhook-timestamp in milliseconds (13 digits).
        const tsRaw = parseInt(cfTimestamp, 10);
        const tsSeconds = tsRaw > 1e10 ? Math.floor(tsRaw / 1000) : tsRaw;
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (isNaN(tsSeconds) || Math.abs(nowSeconds - tsSeconds) > 300) {
            console.error("[webhook] Cashfree timestamp out of acceptable window:", cfTimestamp);
            return Response.json({ error: "Webhook timestamp invalid or expired" }, { status: 400 });
        }

        if (!verifyCashfreeWebhook(rawBody, cfTimestamp, cfSignature)) {
            console.error("[webhook] Invalid Cashfree webhook signature");
            return Response.json({ error: "Invalid signature" }, { status: 401 });
        }
    } else {
        if (!verifyHdfcWebhook(rawBody, hdfcSignature)) {
            console.error("[webhook] Invalid HDFC webhook signature");
            return Response.json({ error: "Invalid signature" }, { status: 401 });
        }
    }

    let payload: any;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    try {
        await connectDB();

        if (isCashfree) {
            return await handleCashfreeWebhook(payload);
        } else {
            return await handleHdfcWebhook(payload);
        }
    } catch (err) {
        console.error("[webhook] Processing error:", err);
        return Response.json({ error: "Processing failed" }, { status: 500 });
    }
}

// ── Cashfree webhook handler ───────────────────────────────────────────────────

async function handleCashfreeWebhook(payload: any) {
    const eventType: string = payload?.type ?? "";
    const data = payload?.data ?? {};

    if (eventType === "PAYMENT_SUCCESS_WEBHOOK") {
        const orderId: string = data?.order?.order_id ?? "";
        const cfPaymentId: string = String(data?.payment?.cf_payment_id ?? "");
        const paidAmount: number = data?.payment?.payment_amount ?? 0;

        if (!orderId || !cfPaymentId) {
            console.error("[webhook/cashfree] Missing orderId or cfPaymentId");
            return Response.json({ success: true });
        }

        return await confirmPayment(orderId, paidAmount, "cashfree");
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

    return Response.json({ success: true });
}

// ── HDFC/Juspay webhook handler ────────────────────────────────────────────────

async function handleHdfcWebhook(payload: any) {
    // Juspay wraps event data under content.order or directly at top level
    const order = payload?.content?.order ?? payload;
    const orderId: string = order?.order_id ?? "";
    const status: string = order?.status ?? "";
    const paidAmount: number = parseFloat(order?.amount ?? "0");

    if (!orderId) {
        console.error("[webhook/hdfc] Missing order_id in payload");
        return Response.json({ success: true });
    }

    if (isHdfcPaid(status)) {
        return await confirmPayment(orderId, paidAmount, "hdfc");
    }

    if (isHdfcFailed(status)) {
        await Registration.findOneAndUpdate(
            { paymentId: orderId, paymentStatus: { $ne: "completed" } },
            { paymentStatus: "failed" }
        );
    }

    return Response.json({ success: true });
}

// ── Shared confirmation logic ──────────────────────────────────────────────────

async function confirmPayment(orderId: string, paidAmount: number, provider: string) {
    // Idempotency: skip if already processed
    const existingReg = await Registration.findOne({
        paymentId: orderId,
        paymentStatus: "completed",
    });

    if (existingReg) {
        console.log(`[webhook/${provider}] Already processed order:`, orderId);
        return Response.json({ success: true, message: "Already processed" });
    }

    const reg = await Registration.findOne({ paymentId: orderId });

    if (reg) {
        const event = await Event.findById(reg.eventId).lean();
        const memberCount = (event as any)?.pricePerPerson && (event as any)?.isTeamEvent
            ? (reg.teamMembers?.length ?? 0) + 1  // teamMembers = others; +1 for leader
            : 1;
        const expectedPrice = ((event as any)?.price ?? 0) * memberCount;
        if (event && paidAmount > 0 && paidAmount < expectedPrice) {
            console.error(
                `[webhook/${provider}] Underpayment for order ${orderId}: paid ${paidAmount}, expected ${expectedPrice}`
            );
            await Registration.findOneAndUpdate(
                { paymentId: orderId, paymentStatus: { $ne: "completed" } },
                { paymentStatus: "failed" }
            );
            return Response.json({ success: true });
        }

        // Atomic update — guards against concurrent webhook retries
        const updated = await Registration.findOneAndUpdate(
            { paymentId: orderId, paymentStatus: { $ne: "completed" } },
            { paymentStatus: "completed", status: "confirmed" },
            { new: true }
        );
        if (!updated) {
            // Another request already set it to completed — idempotent success
            return Response.json({ success: true, message: "Already processed" });
        }
        console.log(`[webhook/${provider}] Payment confirmed for order:`, orderId);

        // Increment registrationCount now that the registration is confirmed
        await Event.findByIdAndUpdate(updated.eventId, { $inc: { registrationCount: 1 } });

        if ((event as any)?.googleSheetId && (event as any)?.sheetTabName) {
            try {
                let sheetsRefreshToken: string | undefined;
                if ((event as any).createdBy) {
                    const creator = await User.findById((event as any).createdBy)
                        .select("+googleSheetsRefreshToken")
                        .lean();
                    sheetsRefreshToken = (creator as any)?.googleSheetsRefreshToken ?? undefined;
                }

                const populatedReg = await Registration.findById(reg._id)
                    .populate("userId", "name email collegeId")
                    .populate("teamMembers.userId", "name email collegeId")
                    .lean();
                const { appendRegistrationRow } = await import("@/lib/sheets");
                await Promise.race([
                    appendRegistrationRow(
                        (event as any).googleSheetId,
                        (event as any).sheetTabName,
                        event as any,
                        populatedReg,
                        sheetsRefreshToken
                    ),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error("Sheet sync timeout")), 8000)
                    ),
                ]);
            } catch (sheetErr) {
                console.error("[webhook] Sheet sync failed (non-fatal):", sheetErr);
            }
        }
    } else {
        console.warn(`[webhook/${provider}] No registration found for order:`, orderId);
    }

    return Response.json({ success: true });
}
