// app/auth/forgot-password/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconArrowLeft, IconMailCheck } from "@tabler/icons-react";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError("Please enter a valid email address.");
            return;
        }

        setLoading(true);
        const result = await requestPasswordReset({ email });
        setLoading(false);

        if (!result.success) {
            setError("Something went wrong. Please try again.");
            return;
        }

        setSubmitted(true);
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
            <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm">
                {submitted ? (
                    // ── Success state ─────────────────────────────────────────
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                            <IconMailCheck size={28} className="text-green-500" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-zinc-900">Check your inbox</h1>
                            <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
                                If an account exists for <span className="font-medium text-zinc-700">{email}</span>,
                                we've sent a password reset link. It expires in 1 hour.
                            </p>
                        </div>
                        <p className="text-xs text-zinc-400">
                            Didn't receive it? Check your spam folder or{" "}
                            <button
                                onClick={() => { setSubmitted(false); setEmail(""); }}
                                className="text-orange-600 hover:underline font-medium"
                            >
                                try again
                            </button>.
                        </p>
                        <Link
                            href="/auth/login"
                            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors mt-2"
                        >
                            <IconArrowLeft size={14} />
                            Back to login
                        </Link>
                    </div>
                ) : (
                    // ── Request form ──────────────────────────────────────────
                    <>
                        <Link
                            href="/auth/login"
                            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-6 transition-colors"
                        >
                            <IconArrowLeft size={14} />
                            Back to login
                        </Link>

                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-zinc-900">Forgot password?</h1>
                            <p className="text-sm text-zinc-500 mt-1">
                                Enter your email and we'll send you a reset link.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="email">Email address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoFocus
                                    required
                                />
                            </div>

                            {error && (
                                <p className="text-sm text-red-500">{error}</p>
                            )}

                            <Button
                                type="submit"
                                className="w-full bg-zinc-900 hover:bg-zinc-700 text-white"
                                disabled={loading}
                            >
                                {loading ? "Sending…" : "Send reset link"}
                            </Button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}