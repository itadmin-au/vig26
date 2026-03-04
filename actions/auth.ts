// actions/auth.ts
"use server";

import { connectDB } from "@/lib/db";
import { User } from "@/models";
import {
    generateInviteToken,
    hashPassword,
    isExpired,
} from "@/lib/utils";
import { sendPasswordResetEmail } from "@/lib/email";
import { z } from "zod";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const requestResetSchema = z.object({
    email: z.string().email(),
});

const resetPasswordSchema = z
    .object({
        token: z.string().min(1),
        password: z
            .string()
            .min(8, "Password must be at least 8 characters")
            .regex(/[A-Z]/, "Must contain at least one uppercase letter")
            .regex(/[0-9]/, "Must contain at least one number"),
        confirmPassword: z.string().min(1),
    })
    .refine((d) => d.password === d.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    });

// ─── Request Reset ────────────────────────────────────────────────────────────

export async function requestPasswordReset(input: unknown) {
    const parsed = requestResetSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: "Invalid email address." };
    }

    await connectDB();

    const user = await User.findOne({
        email: parsed.data.email.toLowerCase().trim(),
    });

    // Always return success to prevent email enumeration
    if (!user) {
        return { success: true };
    }

    // Google-only accounts have no password — don't send a reset
    if (!user.passwordHash) {
        // Still return success silently; user will just get no email
        return { success: true };
    }

    const token = generateInviteToken(); // reuse same 32-byte hex token generator
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await User.findByIdAndUpdate(user._id, {
        passwordResetToken: token,
        passwordResetExpires: expiresAt,
    });

    await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        token,
    });

    return { success: true };
}

// ─── Validate Reset Token ─────────────────────────────────────────────────────

export async function validateResetToken(token: string) {
    if (!token) return { valid: false };

    await connectDB();

    const user = await User.findOne({ passwordResetToken: token });

    if (!user) return { valid: false, error: "Invalid or expired link." };
    if (!user.passwordResetExpires || isExpired(user.passwordResetExpires)) {
        return { valid: false, error: "This reset link has expired. Please request a new one." };
    }

    return { valid: true };
}

// ─── Reset Password ───────────────────────────────────────────────────────────

export async function resetPassword(input: unknown) {
    const parsed = resetPasswordSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    await connectDB();

    const user = await User.findOne({ passwordResetToken: parsed.data.token });

    if (!user) {
        return { success: false, error: "Invalid or expired link." };
    }

    if (!user.passwordResetExpires || isExpired(user.passwordResetExpires)) {
        return { success: false, error: "This reset link has expired. Please request a new one." };
    }

    const hash = await hashPassword(parsed.data.password);

    await User.findByIdAndUpdate(user._id, {
        passwordHash: hash,
        passwordResetToken: null,
        passwordResetExpires: null,
    });

    return { success: true };
}