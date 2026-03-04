// app/auth/login/page.tsx
"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { IconArrowLeft, IconBrandGoogle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "email" | "password";

function LoginPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
    const urlError = searchParams.get("error");

    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(
        urlError === "OAuthAccountNotLinked"
            ? "This email is already registered with a different sign-in method."
            : urlError
                ? "Something went wrong. Please try again."
                : null
    );
    const [loading, setLoading] = useState(false);

    function handleEmailContinue(e: React.FormEvent) {
        e.preventDefault();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError("Please enter a valid email address.");
            return;
        }
        setError(null);
        setStep("password");
    }

    async function handleSignIn(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        setLoading(false);

        if (result?.error) {
            setError(result.error);
            return;
        }

        router.push(callbackUrl);
        router.refresh();
    }

    async function handleGoogleSignIn() {
        setLoading(true);
        await signIn("google", { callbackUrl });
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
            <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm">
                {step === "email" ? (
                    <>
                        <div className="mb-6 text-center">
                            <h1 className="text-2xl font-bold text-zinc-900">Welcome back</h1>
                            <p className="text-sm text-zinc-500 mt-1">Enter your email to continue</p>
                        </div>

                        <form onSubmit={handleEmailContinue} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="email">Email</Label>
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

                            {error && <p className="text-sm text-red-500">{error}</p>}

                            <Button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-700 text-white">
                                Continue
                            </Button>
                        </form>

                        <div className="relative my-5">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-zinc-200" />
                            </div>
                            <div className="relative flex justify-center text-xs text-zinc-400 bg-white px-2">
                                or
                            </div>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                        >
                            <IconBrandGoogle className="mr-2 h-4 w-4" />
                            Continue with Google
                        </Button>

                        <p className="text-center text-sm text-zinc-500 mt-6">
                            Don&apos;t have an account?{" "}
                            <Link href="/auth/signup" className="text-orange-600 font-medium hover:underline">
                                Sign up
                            </Link>
                        </p>
                    </>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={() => { setStep("email"); setError(null); }}
                            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-6 transition-colors"
                        >
                            <IconArrowLeft className="h-4 w-4" />
                            Back
                        </button>

                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-zinc-900">Sign in</h1>
                            <p className="text-sm text-zinc-500 mt-1">{email}</p>
                        </div>

                        <form onSubmit={handleSignIn} className="space-y-4">
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                    <Link
                                        href="/auth/forgot-password"
                                        className="text-xs text-zinc-400 hover:text-orange-600 transition-colors"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoFocus
                                    required
                                />
                            </div>

                            {error && <p className="text-sm text-red-500">{error}</p>}

                            <Button
                                type="submit"
                                className="w-full bg-zinc-900 hover:bg-zinc-700 text-white"
                                disabled={loading}
                            >
                                {loading ? "Signing in…" : "Sign in"}
                            </Button>
                        </form>

                        <p className="text-center text-sm text-zinc-500 mt-4">
                            Don&apos;t have an account?{" "}
                            <Link href="/auth/signup" className="text-orange-600 font-medium hover:underline">
                                Sign up
                            </Link>
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginPageContent />
        </Suspense>
    );
}