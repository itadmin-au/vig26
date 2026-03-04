// app/auth/invite/[token]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { IconCircleCheck, IconLoader2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PageState = "loading" | "set-password" | "existing-user" | "done" | "error";

export default function AcceptInvitePage() {
    const router = useRouter();
    const params = useParams();
    const token = params.token as string;

    const [pageState, setPageState] = useState<PageState>("loading");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [inviteInfo, setInviteInfo] = useState<{ name?: string; department?: string } | null>(null);

    useEffect(() => {
        async function checkToken() {
            try {
                const res = await fetch("/api/auth/invite/check", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token }),
                });
                const data = await res.json();

                if (!data.success) {
                    setError(data.error ?? "Invalid or expired invite link.");
                    setPageState("error");
                    return;
                }

                setInviteInfo({ name: data.name, department: data.department });

                if (data.userExists) {
                    const acceptRes = await fetch("/api/auth/invite/accept", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ token, skipPassword: true }),
                    });
                    const acceptData = await acceptRes.json();
                    if (acceptData.success) {
                        setPageState("existing-user");
                    } else {
                        setError(acceptData.error ?? "Something went wrong.");
                        setPageState("error");
                    }
                } else {
                    setPageState("set-password");
                }
            } catch {
                setError("Something went wrong. Please try again.");
                setPageState("error");
            }
        }
        checkToken();
    }, [token]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        setSubmitting(true);

        const res = await fetch("/api/auth/invite/accept", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password, confirmPassword }),
        });

        const data = await res.json();
        setSubmitting(false);

        if (!data.success) {
            setError(data.error);
            return;
        }

        setPageState("done");
        setTimeout(() => router.push("/manage/login"), 2500);
    }

    if (pageState === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50">
                <IconLoader2 size={28} className="text-zinc-400 animate-spin" />
            </div>
        );
    }

    if (pageState === "error") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
                <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm text-center">
                    <p className="text-sm text-red-500 mb-4">{error}</p>
                    <Button asChild variant="outline">
                        <Link href="/manage/login">Go to login</Link>
                    </Button>
                </div>
            </div>
        );
    }

    if (pageState === "existing-user") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
                <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm text-center">
                    <div className="flex justify-center mb-4">
                        <IconCircleCheck className="h-12 w-12 text-green-500" />
                    </div>
                    <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">
                        Vigyanrang
                    </p>
                    <h1 className="text-xl font-bold text-zinc-900 mb-2">
                        You&apos;ve been added{inviteInfo?.department ? ` to ${inviteInfo.department}` : ""}!
                    </h1>
                    <p className="text-sm text-zinc-500 mb-6">
                        Your existing account has been linked. Sign in with your current password.
                    </p>
                    <Button
                        asChild
                        className="w-full bg-primary hover:bg-primary/80 text-primary-foreground"
                    >
                        <Link href="/manage/login">Sign in now</Link>
                    </Button>
                </div>
            </div>
        );
    }

    if (pageState === "done") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
                <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm text-center">
                    <div className="flex justify-center mb-4">
                        <IconCircleCheck className="h-12 w-12 text-green-500" />
                    </div>
                    <h1 className="text-xl font-bold text-zinc-900 mb-2">You&apos;re all set!</h1>
                    <p className="text-sm text-zinc-500">
                        Your account has been created. Redirecting you to sign in…
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
            <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm">
                <div className="mb-6">
                    <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">
                        Vigyanrang
                    </p>
                    <h1 className="text-2xl font-bold text-zinc-900">Accept Invite</h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        {inviteInfo?.name ? `Hi ${inviteInfo.name}! ` : ""}
                        Set a password to activate your account
                        {inviteInfo?.department ? ` and join ${inviteInfo.department}` : ""}.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="Min. 8 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoFocus
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <Button
                        type="submit"
                        className="w-full bg-primary hover:bg-primary/80 text-primary-foreground"
                        disabled={submitting}
                    >
                        {submitting ? "Activating account…" : "Activate account"}
                    </Button>
                </form>

                <p className="text-center text-sm text-zinc-500 mt-6">
                    Already have an account?{" "}
                    <Link href="/manage/login" className="text-orange-600 font-medium hover:underline">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}