// app/page.tsx
import Link from "next/link";

export default function TemporaryLandingPage() {
    return (
        // -mt-16 pulls the page back up behind the fixed navbar (escaping layout's pt-16)
        // min-h-screen ensures it fills the full viewport height including that 64px
        <div className="-mt-16 min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
            <div className="text-center max-w-lg">
                <p className="text-xs font-semibold text-orange-500 uppercase tracking-widest mb-4">
                    Coming Soon
                </p>
                <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
                    Vigyan<span className="text-orange-500">rang</span>
                </h1>
                <p className="text-zinc-400 text-base mb-10">
                    The official platform for registrations, events, and everything in between.
                </p>
                <div className="flex items-center justify-center gap-3">
                    <Link
                        href="/events"
                        className="px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                        Browse Events
                    </Link>
                    <Link
                        href="/auth/login"
                        className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold rounded-lg transition-colors"
                    >
                        Sign In
                    </Link>
                </div>
            </div>

            <div className="absolute bottom-6 text-xs text-zinc-600">
                Management?{" "}
                <Link href="/manage/login" className="text-zinc-400 hover:text-zinc-200 transition-colors">
                    Sign in here
                </Link>
            </div>
        </div>
    );
}