// app/auth/error/page.tsx
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { IconCircleX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

const ERROR_MESSAGES: Record<string, string> = {
    OAuthAccountNotLinked: "This email is already registered with a different sign-in method.",
    OAuthNotAllowed: "Management accounts must sign in with email and password.",
    CredentialsSignin: "Incorrect email or password.",
    Default: "Something went wrong during sign in. Please try again.",
};

function AuthErrorContent() {
    const searchParams = useSearchParams();
    const error = searchParams.get("error") ?? "Default";
    const message = ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default;

    return (
        <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm text-center">
            <div className="flex justify-center mb-4">
                <IconCircleX className="h-12 w-12 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-zinc-900 mb-2">Sign in failed</h1>
            <p className="text-sm text-zinc-500 mb-6">{message}</p>
            <Button asChild className="bg-zinc-900 hover:bg-zinc-700 text-white">
                <Link href="/auth/login">Try again</Link>
            </Button>
        </div>
    );
}

export default function AuthErrorPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
            <Suspense>
                <AuthErrorContent />
            </Suspense>
        </div>
    );
}