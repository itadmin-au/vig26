"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OnboardingPage() {
    const { data: session, status, update } = useSession();
    const router = useRouter();

    const [name, setName] = useState("");
    const [collegeId, setCollegeId] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/auth/login");
        } else if (status === "authenticated" && !session?.user?.needsOnboarding) {
            router.replace("/dashboard");
        }
        if (status === "authenticated" && session?.user?.name && !name) {
            setName(session.user.name);
        }
    }, [status, session, router, name]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const res = await fetch("/api/auth/onboarding", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, collegeId }),
        });

        const data = await res.json();

        if (!data.success) {
            setError(data.error);
            setLoading(false);
            return;
        }

        // Refresh the JWT so needsOnboarding is cleared immediately
        await update();

        router.push("/dashboard");
        router.refresh();
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
            <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold text-zinc-900">Complete your profile</h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        We need a few more details before you can register for events.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                            id="name"
                            placeholder="Jane Smith"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="collegeId">USN</Label>
                        <Input
                            id="collegeId"
                            placeholder="e.g. 4VP22CS001"
                            value={collegeId}
                            onChange={(e) => setCollegeId(e.target.value.toUpperCase())}
                            required
                        />
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <Button
                        type="submit"
                        className="w-full bg-zinc-900 hover:bg-zinc-700 text-white"
                        disabled={loading}
                    >
                        {loading ? "Saving…" : "Continue"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
