// app/auth/reset-password/[token]/page.tsx
"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { validateResetToken, resetPassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    IconLoader2,
    IconAlertCircle,
    IconCircleCheck,
    IconArrowLeft,
    IconEye,
    IconEyeOff,
} from "@tabler/icons-react";

interface PageProps {
    params: Promise<{ token: string }>;
}

type PageState = "validating" | "invalid" | "form" | "success";

export default function ResetPasswordPage({ params }: PageProps) {
    const router = useRouter();
    const { token } = use(params);

    const [pageState, setPageState] = useState<PageState>("validating");
    const [tokenError, setTokenError] = useState<string | null>(null);

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Validate token on mount
    useEffect(() => {
        async function validate() {
            const result = await validateResetToken(token);
            if (result.valid) {
                setPageState("form");
            } else {
                setTokenError(result.error ?? "Invalid or expired link.");
                setPageState("invalid");
            }
        }
        validate();
    }, [token]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setFormError(null);

        if (password !== confirmPassword) {
            setFormError("Passwords do not match.");
            return;
        }

        setLoading(true);
        const result = await resetPassword({ token, password, confirmPassword });
        setLoading(false);

        if (!result.success) {
            setFormError(result.error ?? "Something went wrong.");
            return;
        }

        setPageState("success");
        // Redirect to login after 2.5s
        setTimeout(() => router.push("/auth/login"), 2500);
    }

    // ── Validating ────────────────────────────────────────────────────────────
    if (pageState === "validating") {
        return (
            <AuthShell>
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <IconLoader2 size={28} className="text-zinc-400 animate-spin" />
                    <p className="text-sm text-zinc-500">Validating link…</p>
                </div>
            </AuthShell>
        );
    }

    // ── Invalid token ─────────────────────────────────────────────────────────
    if (pageState === "invalid") {
        return (
            <AuthShell>
                <div className="text-center space-y-4">
                    <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                        <IconAlertCircle size={26} className="text-red-500" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-zinc-900">Link expired</h1>
                        <p className="text-sm text-zinc-500 mt-1.5 leading-relaxed">
                            {tokenError}
                        </p>
                    </div>
                    <Link
                        href="/auth/forgot-password"
                        className="inline-block mt-2 px-5 py-2.5 rounded-lg bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-700 transition-colors"
                    >
                        Request a new link
                    </Link>
                    <div>
                        <Link
                            href="/auth/login"
                            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
                        >
                            <IconArrowLeft size={13} />
                            Back to login
                        </Link>
                    </div>
                </div>
            </AuthShell>
        );
    }

    // ── Success ───────────────────────────────────────────────────────────────
    if (pageState === "success") {
        return (
            <AuthShell>
                <div className="text-center space-y-4">
                    <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                        <IconCircleCheck size={26} className="text-green-500" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-zinc-900">Password updated!</h1>
                        <p className="text-sm text-zinc-500 mt-1.5">
                            Redirecting you to login…
                        </p>
                    </div>
                    <IconLoader2 size={18} className="text-zinc-300 animate-spin mx-auto" />
                </div>
            </AuthShell>
        );
    }

    // ── Reset form ────────────────────────────────────────────────────────────
    return (
        <AuthShell>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-zinc-900">Set new password</h1>
                <p className="text-sm text-zinc-500 mt-1">
                    Choose a strong password for your account.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="password">New password</Label>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoFocus
                            required
                            className="pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                            tabIndex={-1}
                        >
                            {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                        </button>
                    </div>
                    <p className="text-xs text-zinc-400">
                        Min 8 chars, one uppercase letter, one number.
                    </p>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <div className="relative">
                        <Input
                            id="confirmPassword"
                            type={showConfirm ? "text" : "password"}
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                            tabIndex={-1}
                        >
                            {showConfirm ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                        </button>
                    </div>
                </div>

                {formError && (
                    <p className="text-sm text-red-500">{formError}</p>
                )}

                <Button
                    type="submit"
                    className="w-full bg-zinc-900 hover:bg-zinc-700 text-white"
                    disabled={loading}
                >
                    {loading ? (
                        <><IconLoader2 size={14} className="mr-1.5 animate-spin" />Updating…</>
                    ) : (
                        "Update password"
                    )}
                </Button>
            </form>

            <div className="mt-5 text-center">
                <Link
                    href="/auth/login"
                    className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
                >
                    <IconArrowLeft size={13} />
                    Back to login
                </Link>
            </div>
        </AuthShell>
    );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function AuthShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
            <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm">
                <div className="text-center mb-7">
                    <span className="text-xl font-bold text-zinc-900">
                        Vigyan<span className="text-orange-500">rang</span>
                    </span>
                </div>
                {children}
            </div>
        </div>
    );
}