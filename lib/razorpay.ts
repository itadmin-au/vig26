// lib/razorpay.ts
import Razorpay from "razorpay";

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error(
        "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in environment variables."
    );
}

// Singleton — prevent multiple instances during hot reload in dev
declare global {
    // eslint-disable-next-line no-var
    var _razorpayInstance: Razorpay | undefined;
}

function getRazorpay(): Razorpay {
    if (!global._razorpayInstance) {
        global._razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID!,
            key_secret: process.env.RAZORPAY_KEY_SECRET!,
        });
    }
    return global._razorpayInstance;
}

export { getRazorpay };