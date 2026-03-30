// lib/cashfree.ts
// Server-side Cashfree Payments API helper (REST, no SDK dependency)

const BASE_URL =
    process.env.NODE_ENV === "production"
        ? "https://api.cashfree.com/pg"
        : "https://sandbox.cashfree.com/pg";

function getHeaders() {
    return {
        "x-client-id": process.env.NEXT_PUBLIC_CASHFREE_APP_ID!,
        "x-client-secret": process.env.CASHFREE_SECRET_KEY!,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json",
    };
}

export async function createCashfreeOrder(params: {
    orderId: string;
    amount: number;
    customerId: string;
    customerName: string;
    customerEmail: string;
    orderNote?: string;
}): Promise<{ order_id: string; payment_session_id: string; order_status: string }> {
    const res = await fetch(`${BASE_URL}/orders`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
            order_id: params.orderId,
            order_amount: params.amount,
            order_currency: "INR",
            order_note: params.orderNote,
            customer_details: {
                customer_id: params.customerId,
                customer_name: params.customerName,
                customer_email: params.customerEmail,
                customer_phone: "9999999999", // required by Cashfree; no phone in our user model
            },
            order_meta: {
                payment_methods: "upi", // restrict checkout to UPI only
            },
        }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "Failed to create Cashfree order");
    return data;
}

export async function getCashfreeOrder(
    orderId: string
): Promise<{ order_id: string; order_status: string; cf_order_id: string }> {
    const res = await fetch(`${BASE_URL}/orders/${orderId}`, {
        method: "GET",
        headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "Failed to fetch Cashfree order");
    return data;
}
