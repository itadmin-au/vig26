// app/account/page.tsx
"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    IconUser, IconMail, IconLock, IconLogout,
    IconCheck, IconLoader2, IconAlertCircle, IconShield, IconPencil, IconX,
} from "@tabler/icons-react";

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, description, children }: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100">
                <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
                {description && <p className="text-xs text-zinc-400 mt-0.5">{description}</p>}
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

// ─── Field row ────────────────────────────────────────────────────────────────

function FieldRow({ label, value, icon: Icon }: {
    label: string;
    value: string;
    icon: React.ElementType;
}) {
    return (
        <div className="flex items-center gap-3 py-3 border-b border-zinc-100 last:border-0">
            <div className="w-8 h-8 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0">
                <Icon size={14} className="text-zinc-400" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-400">{label}</p>
                <p className="text-sm font-medium text-zinc-800 truncate">{value}</p>
            </div>
        </div>
    );
}

// ─── Edit name form ───────────────────────────────────────────────────────────

function EditNameForm({ currentName, onSaved }: { currentName: string; onSaved: (name: string) => void }) {
    const { update } = useSession();
    const [name, setName] = useState(currentName);
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErrorMsg("");
        if (name.trim() === currentName) { onSaved(currentName); return; }
        setStatus("loading");
        try {
            const res = await fetch("/api/account/update-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
            await update({ name: data.name });
            setStatus("success");
            onSaved(data.name);
        } catch (err: any) {
            setErrorMsg(err.message);
            setStatus("error");
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-1">
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                className="flex-1 px-3 py-1.5 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-colors"
            />
            <button
                type="submit"
                disabled={status === "loading"}
                className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
                {status === "loading" ? <IconLoader2 size={13} className="animate-spin" /> : <IconCheck size={13} />}
                Save
            </button>
            <button type="button" onClick={() => onSaved(currentName)} className="p-1.5 text-zinc-400 hover:text-zinc-600">
                <IconX size={14} />
            </button>
            {errorMsg && <span className="text-xs text-red-600">{errorMsg}</span>}
        </form>
    );
}

// ─── Password change form ─────────────────────────────────────────────────────

function ChangePasswordForm() {
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErrorMsg("");

        if (next !== confirm) {
            setErrorMsg("New passwords do not match.");
            return;
        }
        if (next.length < 8) {
            setErrorMsg("Password must be at least 8 characters.");
            return;
        }

        setStatus("loading");
        try {
            const res = await fetch("/api/account/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword: current, newPassword: next }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
            setStatus("success");
            setCurrent(""); setNext(""); setConfirm("");
            setTimeout(() => setStatus("idle"), 3000);
        } catch (err: any) {
            setErrorMsg(err.message);
            setStatus("error");
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            {[
                { label: "Current password", value: current, onChange: setCurrent },
                { label: "New password", value: next, onChange: setNext },
                { label: "Confirm new password", value: confirm, onChange: setConfirm },
            ].map(({ label, value, onChange }) => (
                <div key={label}>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">{label}</label>
                    <input
                        type="password"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-colors"
                    />
                </div>
            ))}

            {(status === "error" || errorMsg) && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <IconAlertCircle size={13} className="shrink-0" />
                    {errorMsg}
                </div>
            )}

            {status === "success" && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                    <IconCheck size={13} className="shrink-0" />
                    Password updated successfully.
                </div>
            )}

            <button
                type="submit"
                disabled={status === "loading"}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
                {status === "loading" ? (
                    <><IconLoader2 size={13} className="animate-spin" /> Updating…</>
                ) : (
                    "Update password"
                )}
            </button>
        </form>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const isOAuth = !!(session?.user as any)?.isOAuthUser;
    const [editingName, setEditingName] = useState(false);
    const displayName = session?.user?.name ?? "—";

    return (
        <div className="min-h-screen bg-zinc-50 pt-16">
            <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">

                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Account</h1>
                    <p className="text-sm text-zinc-500 mt-0.5">Manage your profile and settings.</p>
                </div>

                {/* Profile */}
                <Section title="Profile" description="Your account information.">
                    <div className="flex items-center gap-4 pb-4 mb-1 border-b border-zinc-100">
                        <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xl font-bold shrink-0">
                            {displayName[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div>
                            <p className="font-semibold text-zinc-900 text-base">{displayName}</p>
                            <p className="text-sm text-zinc-400">{session?.user?.email}</p>
                            {(session?.user as any)?.role && (
                                <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium capitalize">
                                    {(session?.user as any).role}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Full name row with inline edit */}
                    <div className="flex items-center gap-3 py-3 border-b border-zinc-100">
                        <div className="w-8 h-8 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0">
                            <IconUser size={14} className="text-zinc-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs text-zinc-400">Full name</p>
                            {editingName ? (
                                <EditNameForm
                                    currentName={displayName}
                                    onSaved={() => setEditingName(false)}
                                />
                            ) : (
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-zinc-800 truncate">{displayName}</p>
                                    <button onClick={() => setEditingName(true)} className="text-zinc-400 hover:text-zinc-600">
                                        <IconPencil size={13} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <FieldRow label="Email address" value={session?.user?.email ?? "—"} icon={IconMail} />
                    <FieldRow
                        label="Sign-in method"
                        value={isOAuth ? "Google (OAuth)" : "Email & Password"}
                        icon={IconShield}
                    />
                </Section>

                {/* Password — only show for credential accounts */}
                {!isOAuth && (
                    <Section
                        title="Change Password"
                        description="Use a strong password you don't use elsewhere."
                    >
                        <ChangePasswordForm />
                    </Section>
                )}

                {/* Danger zone */}
                <Section title="Session">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-zinc-800">Sign out</p>
                            <p className="text-xs text-zinc-400 mt-0.5">You'll be redirected to the home page.</p>
                        </div>
                        <button
                            onClick={() => signOut({ callbackUrl: "/" })}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
                        >
                            <IconLogout size={15} />
                            Sign Out
                        </button>
                    </div>
                </Section>

            </main>
        </div>
    );
}