// app/auth/signup/page.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconBrandGoogle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
    const router = useRouter();

    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        collegeId: "",
    });
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (form.password !== form.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);

        const res = await fetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: form.name,
                email: form.email,
                password: form.password,
                collegeId: form.collegeId || undefined,
            }),
        });

        const data = await res.json();

        if (!data.success) {
            setError(data.error);
            setLoading(false);
            return;
        }

        const result = await signIn("credentials", {
            email: form.email,
            password: form.password,
            redirect: false,
        });

        setLoading(false);

        if (result?.error) {
            router.push("/auth/login?message=AccountCreated");
            return;
        }

        router.push("/dashboard");
        router.refresh();
    }

    async function handleGoogleSignIn() {
        setLoading(true);
        await signIn("google", { callbackUrl: "/dashboard" });
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
            <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold text-zinc-900">Create your account</h1>
                    <p className="text-sm text-zinc-500 mt-1">Sign up to register for events</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                            id="name"
                            name="name"
                            placeholder="Jane Smith"
                            value={form.name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="you@example.com"
                            value={form.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="collegeId">USN</Label>
                        <Input
                            id="collegeId"
                            name="collegeId"
                            placeholder="e.g. 4VP22CS001"
                            value={form.collegeId}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="Min. 8 characters"
                            value={form.password}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            placeholder="••••••••"
                            value={form.confirmPassword}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <Button
                        type="submit"
                        className="w-full bg-zinc-900 hover:bg-zinc-700 text-white"
                        disabled={loading}
                    >
                        {loading ? "Creating account…" : "Create account"}
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
                    Already have an account?{" "}
                    <Link href="/auth/login" className="text-orange-600 font-medium hover:underline">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}