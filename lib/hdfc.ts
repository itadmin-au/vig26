// lib/hdfc.ts
// Server-side HDFC SmartGateway (Juspay) API helper
import crypto from "crypto";

const _hdfcEnv = process.env.HDFC_ENV ?? "sandbox";
const BASE_URL = _hdfcEnv.startsWith("https://")
    ? _hdfcEnv.replace(/\/$/, "")            // allow full URL in HDFC_ENV
    : _hdfcEnv === "production"
        ? "https://smartgateway.hdfcbank.com"
        : "https://smartgatewayuat.hdfcbank.com";

function getAuthHeader(): string {
    const apiKey = process.env.HDFC_API_KEY;
    if (!apiKey) {
        throw new Error(
            "HDFC credentials missing — HDFC_API_KEY is not set. Restart the dev server after adding it to .env.local."
        );
    }
    return "Basic " + Buffer.from(`${apiKey}:`).toString("base64");
}

export async function createHdfcOrder(params: {
    orderId: string;
    amount: number;
    customerId: string;
    customerEmail: string;
    returnUrl: string;
    orderNote?: string;
}): Promise<{ order_id: string; payment_link: string }> {
    const paymentPageClientId = process.env.HDFC_PAYMENT_PAGE_CLIENT_ID;
    if (!paymentPageClientId) {
        throw new Error(
            "HDFC_PAYMENT_PAGE_CLIENT_ID is not set. Restart the dev server after adding it to .env.local."
        );
    }

    const res = await fetch(`${BASE_URL}/session`, {
        method: "POST",
        headers: {
            Authorization: getAuthHeader(),
            "Content-Type": "application/json",
            version: "2023-01-01",
        },
        body: JSON.stringify({
            order_id: params.orderId,
            amount: params.amount.toFixed(2),
            customer_id: params.customerId,
            customer_email: params.customerEmail,
            customer_phone: "9999999999", // required by Juspay; no phone in user model
            payment_page_client_id: paymentPageClientId,
            action: "paymentPage",
            return_url: params.returnUrl,
            currency: "INR",
            description: params.orderNote ?? "Event Registration",
            payment_filter: {
                allowed_payment_methods: ["UPI"],
            },
        }),
    });

    const data = await res.json();
    if (!res.ok) {
        console.error("[hdfc] createOrder failed:", JSON.stringify(data));
        throw new Error(data.user_message ?? data.error_message ?? "Failed to create HDFC order");
    }

    const paymentLink: string = data?.payment_links?.web ?? "";
    if (!paymentLink) {
        console.error("[hdfc] No payment_links.web in response:", JSON.stringify(data));
        throw new Error("HDFC did not return a payment link");
    }

    return { order_id: data.order_id ?? params.orderId, payment_link: paymentLink };
}

export async function getHdfcOrderStatus(
    orderId: string
): Promise<{ order_id: string; status: string; amount: number; description?: string }> {
    const res = await fetch(`${BASE_URL}/orders/${orderId}`, {
        method: "GET",
        headers: {
            Authorization: getAuthHeader(),
            version: "2023-01-01",
        },
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.user_message ?? data.error_message ?? "Failed to fetch HDFC order");
    }

    return {
        order_id: data.order_id ?? orderId,
        status: data.status ?? "",
        amount: parseFloat(data.amount ?? "0"),
        description: data.description ?? data.order_description ?? undefined,
    };
}

/**
 * Verify an HDFC/Juspay webhook signature.
 * Juspay signs: HMAC-SHA256(apiKey, rawBody), then base64-encodes it.
 * Header: "signature"
 */
export function verifyHdfcWebhook(rawBody: string, signature: string): boolean {
    const apiKey = process.env.HDFC_API_KEY;
    if (!apiKey) return false;

    const expected = crypto
        .createHmac("sha256", apiKey)
        .update(rawBody)
        .digest("base64");

    try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
        return false;
    }
}

/** Returns true if the given HDFC order status means payment is complete. */
export function isHdfcPaid(status: string): boolean {
    return status === "CHARGED";
}

/** Returns true if the given HDFC order status means payment has definitively failed. */
export function isHdfcFailed(status: string): boolean {
    return ["AUTHORIZATION_FAILED", "AUTHENTICATION_FAILED", "JUSPAY_DECLINED"].includes(status);
}
