// components/navbar.tsx
"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { IconMenu2, IconX, IconTicket, IconLogout, IconUser } from "@tabler/icons-react";

export function Navbar() {
    const { data: session } = useSession();
    const [menuOpen, setMenuOpen] = useState(false);
    const [avatarOpen, setAvatarOpen] = useState(false);

    return (
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-zinc-200">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
                {/* Logo */}
                <Link href="/" className="text-base font-bold text-zinc-900 shrink-0">
                    Vigyan<span className="text-orange-500">rang</span>
                </Link>

                {/* Desktop nav */}
                <nav className="hidden sm:flex items-center gap-6">
                    <Link href="/events" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium">
                        Events
                    </Link>
                    {session && (
                        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium">
                            My Tickets
                        </Link>
                    )}
                </nav>

                {/* Desktop auth */}
                <div className="hidden sm:flex items-center gap-2">
                    {session ? (
                        <div className="relative">
                            <button
                                onClick={() => setAvatarOpen((v) => !v)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
                            >
                                <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-bold">
                                    {session.user?.name?.[0]?.toUpperCase() ?? "U"}
                                </div>
                                <span className="text-sm font-medium text-zinc-700 max-w-30 truncate">
                                    {session.user?.name?.split(" ")[0]}
                                </span>
                            </button>
                            {avatarOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setAvatarOpen(false)} />
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-zinc-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                                        <Link
                                            href="/dashboard"
                                            onClick={() => setAvatarOpen(false)}
                                            className="flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50"
                                        >
                                            <IconTicket size={15} className="text-zinc-400" />
                                            My Dashboard
                                        </Link>
                                        <div className="my-1 border-t border-zinc-100" />
                                        <button
                                            onClick={() => signOut({ callbackUrl: "/" })}
                                            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50"
                                        >
                                            <IconLogout size={15} />
                                            Sign Out
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            <Link
                                href="/auth/login"
                                className="text-sm font-medium text-zinc-600 hover:text-zinc-900 px-3 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
                            >
                                Sign In
                            </Link>
                            <Link
                                href="/auth/signup"
                                className="text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                Sign Up
                            </Link>
                        </>
                    )}
                </div>

                {/* Mobile hamburger */}
                <button
                    className="sm:hidden p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 transition-colors"
                    onClick={() => setMenuOpen((v) => !v)}
                >
                    {menuOpen ? <IconX size={20} /> : <IconMenu2 size={20} />}
                </button>
            </div>

            {/* Mobile menu */}
            {menuOpen && (
                <div className="sm:hidden border-t border-zinc-100 bg-white px-4 py-3 space-y-1">
                    <Link
                        href="/events"
                        onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 rounded-lg"
                    >
                        Events
                    </Link>
                    {session ? (
                        <>
                            <Link
                                href="/dashboard"
                                onClick={() => setMenuOpen(false)}
                                className="block px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 rounded-lg"
                            >
                                My Tickets
                            </Link>
                            <button
                                onClick={() => signOut({ callbackUrl: "/" })}
                                className="w-full text-left px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg"
                            >
                                Sign Out
                            </button>
                        </>
                    ) : (
                        <>
                            <Link
                                href="/auth/login"
                                onClick={() => setMenuOpen(false)}
                                className="block px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 rounded-lg"
                            >
                                Sign In
                            </Link>
                            <Link
                                href="/auth/signup"
                                onClick={() => setMenuOpen(false)}
                                className="block px-3 py-2.5 text-sm font-medium text-white bg-zinc-900 rounded-lg text-center"
                            >
                                Sign Up
                            </Link>
                        </>
                    )}
                </div>
            )}
        </header>
    );
}