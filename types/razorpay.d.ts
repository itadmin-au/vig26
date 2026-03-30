// types/cashfree.d.ts
// Type declarations for the Cashfree v3 frontend JS SDK loaded via script tag.

interface CashfreeCheckoutOptions {
    paymentSessionId: string;
    redirectTarget?: "_modal" | "_self" | "_blank" | "_top";
}

interface CashfreeCheckoutResult {
    error?: {
        message: string;
        type?: string;
        code?: string;
    };
    redirect?: boolean;
    paymentDetails?: {
        paymentMessage: string;
    };
}

interface CashfreeInstance {
    checkout(options: CashfreeCheckoutOptions): Promise<CashfreeCheckoutResult>;
}

interface Window {
    Cashfree: (config: { mode: "sandbox" | "production" }) => CashfreeInstance;
}
