// types/razorpay.d.ts
// Type declarations for the Razorpay frontend checkout SDK loaded via script tag.
// The npm `razorpay` package only covers the server-side Node API.

interface RazorpayOptions {
    key: string;
    amount: number;          // in paise
    currency: string;
    name: string;
    description?: string;
    image?: string;
    order_id: string;
    handler: (response: RazorpayPaymentResponse) => void;
    prefill?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    notes?: Record<string, string>;
    theme?: {
        color?: string;
    };
    modal?: {
        ondismiss?: () => void;
        escape?: boolean;
        backdropclose?: boolean;
        confirm_close?: boolean;
    };
    config?: {
        display?: {
            blocks?: Record<string, {
                name?: string;
                instruments?: { method: string }[];
            }>;
            sequence?: string[];
            preferences?: {
                show_default_blocks?: boolean;
            };
        };
    };
    // Method-level toggles — "1" to enable, "0" to disable
    method?: {
        upi?: "0" | "1";
        card?: "0" | "1";
        netbanking?: "0" | "1";
        wallet?: "0" | "1";
        paylater?: "0" | "1";
        emi?: "0" | "1";
    };
}

interface RazorpayPaymentResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
}

interface RazorpayInstance {
    open(): void;
    close(): void;
    on(event: "payment.failed", handler: (response: { error: RazorpayErrorResponse }) => void): void;
}

interface RazorpayErrorResponse {
    code: string;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata: {
        order_id: string;
        payment_id?: string;
    };
}

interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
}