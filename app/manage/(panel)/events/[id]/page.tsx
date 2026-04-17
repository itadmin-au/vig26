// app/manage/(panel)/events/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { getManageEvents, generateCsvToken, syncEventRegistrationCount, toggleRegistrations, publishEvent, cancelEvent, getEventAuditLog } from "@/actions/events";
import { getEventRegistrations, toggleAttendance } from "@/actions/registrations";
import { toast } from "sonner";
import {
    IconEdit, IconArrowLeft, IconDownload,
    IconCalendarEvent, IconMapPin, IconUsers, IconCurrencyRupee,
    IconLoader2, IconTableExport, IconCopy,
    IconBrandGoogle, IconExternalLink, IconUnlink, IconRefresh,
    IconLock, IconLockOpen, IconPlayerPlay, IconBan, IconActivity,
} from "@tabler/icons-react";
import type { IEvent, IRegistration } from "@/types";
import "@uiw/react-markdown-preview/markdown.css";

const MDPreview = dynamic(() => import("@uiw/react-markdown-preview"), { ssr: false });

// ─── CSV utility ──────────────────────────────────────────────────────────────

function downloadCSV(filename: string, rows: string[][]) {
    const csv = rows
        .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Export: same structure as Google Sheet sync (one row per registration) ───

function exportGoogleSheetStyleCSV(event: IEvent, registrations: any[]) {
    const customFields = event.customForm ?? [];
    const maxMembers = (event as any).isTeamEvent ? ((event as any).teamSize?.max ?? 0) : 0;

    const memberCols: string[] = [];
    for (let i = 1; i <= maxMembers; i++) {
        memberCols.push(`Member ${i} Name`, `Member ${i} Email`, `Member ${i} College ID`);
    }

    const headers = [
        "Registration ID",
        "Name",
        "Email",
        "College ID",
        "Type",
        "Team ID",
        "Team Size",
        "Status",
        "Payment Status",
        "Registered At",
        ...customFields.map((f) => f.label),
        ...memberCols,
    ];

    const rows: string[][] = [headers];

    for (const reg of registrations) {
        const responseMap: Record<string, string> = {};
        for (const r of reg.formResponses ?? []) {
            responseMap[r.fieldId] = r.value ?? "";
        }
        const additionalMembers: any[] = reg.teamMembers ?? [];
        const allMembers = [
            {
                name: reg.userId?.name ?? "",
                email: reg.userId?.email ?? "",
                collegeId: reg.userId?.collegeId ?? "",
            },
            ...additionalMembers.map((m: any) => ({
                name: m.name ?? "",
                email: m.email ?? "",
                collegeId: m.userId?.collegeId ?? "",
            })),
        ];

        const memberCells: string[] = [];
        for (let i = 0; i < maxMembers; i++) {
            memberCells.push(
                allMembers[i]?.name ?? "",
                allMembers[i]?.email ?? "",
                allMembers[i]?.collegeId ?? ""
            );
        }

        rows.push([
            reg._id,
            reg.userId?.name ?? "—",
            reg.userId?.email ?? "—",
            reg.userId?.collegeId ?? "—",
            reg.isTeamRegistration ? "Team" : "Individual",
            reg.teamId ?? "—",
            reg.isTeamRegistration ? String(additionalMembers.length + 1) : "1",
            reg.status,
            reg.paymentStatus,
            new Date(reg.createdAt).toLocaleString("en-IN"),
            ...customFields.map((f) => responseMap[f._id] ?? ""),
            ...memberCells,
        ]);
    }

    const safeName = event.title.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    downloadCSV(`${safeName}-registrations.csv`, rows);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManageEventDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { data: session } = useSession();
    const isSuperAdmin = session?.user?.role === "super_admin";

    const [event, setEvent] = useState<IEvent | null>(null);
    const [registrations, setRegistrations] = useState<IRegistration[]>([]);
    const [loading, setLoading] = useState(true);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"overview" | "registrations" | "activity">("overview");
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [generatingToken, setGeneratingToken] = useState(false);
    const [sheetsConnected, setSheetsConnected] = useState(false);
    const [creatingSheet, setCreatingSheet] = useState(false);
    const [unlinkingSheet, setUnlinkingSheet] = useState(false);
    const [syncingSheet, setSyncingSheet] = useState(false);
    const [togglingRegs, setTogglingRegs] = useState(false);
    const [publishingEvent, setPublishingEvent] = useState(false);
    const [cancellingEvent, setCancellingEvent] = useState(false);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const [eventsData, regsResult, sheetsStatus] = await Promise.all([
                    getManageEvents(),
                    getEventRegistrations(id),
                    fetch("/api/auth/google-sheets/status").then((r) => r.json()),
                    syncEventRegistrationCount(id),
                ]);
                const found = eventsData.find((e) => e._id.toString() === id) ?? null;
                setEvent(found);
                if (regsResult.success) setRegistrations(regsResult.data as IRegistration[]);
                setSheetsConnected(sheetsStatus.connected ?? false);
            } catch {
                toast.error("Failed to load event.");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);

    useEffect(() => {
        if (activeTab !== "activity" || !isSuperAdmin) return;
        setLoadingLogs(true);
        getEventAuditLog(id).then((result) => {
            if (result.success) setAuditLogs(result.data as any[]);
            setLoadingLogs(false);
        });
    }, [activeTab, id, isSuperAdmin]);

    // Show a toast if returning from Google OAuth
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("sheet_connected")) {
            toast.success("Google account connected! You can now create a sheet.");
            setSheetsConnected(true);
            window.history.replaceState({}, "", window.location.pathname);
        } else if (params.get("sheet_error")) {
            toast.error("Failed to connect Google account. Please try again.");
            window.history.replaceState({}, "", window.location.pathname);
        }
    }, []);

    async function handleCreateSheet() {
        setCreatingSheet(true);
        try {
            const res = await fetch(`/api/events/${id}/sheet`, { method: "POST" });
            const json = await res.json();
            if (json.success) {
                setEvent((prev) => prev ? { ...prev, googleSheetId: json.sheetId } as any : prev);
                toast.success("Sheet created! Opening now…");
                window.open(json.sheetUrl, "_blank");
            } else {
                toast.error(json.error ?? "Failed to create sheet.");
            }
        } catch {
            toast.error("Failed to create sheet.");
        } finally {
            setCreatingSheet(false);
        }
    }

    async function handleSyncSheet() {
        setSyncingSheet(true);
        try {
            const res = await fetch(`/api/events/${id}/sheet`, { method: "PATCH" });
            const json = await res.json();
            if (json.success) {
                toast.success(`Sheet synced — ${json.synced} registration${json.synced !== 1 ? "s" : ""} written.`);
            } else {
                toast.error(json.error ?? "Sync failed.");
            }
        } catch {
            toast.error("Sync failed.");
        } finally {
            setSyncingSheet(false);
        }
    }

    async function handleUnlinkSheet() {
        setUnlinkingSheet(true);
        try {
            const res = await fetch(`/api/events/${id}/sheet`, { method: "DELETE" });
            const json = await res.json();
            if (json.success) {
                setEvent((prev) => prev ? { ...prev, googleSheetId: null } as any : prev);
                toast.success("Sheet unlinked.");
            } else {
                toast.error(json.error ?? "Failed to unlink sheet.");
            }
        } catch {
            toast.error("Failed to unlink sheet.");
        } finally {
            setUnlinkingSheet(false);
        }
    }

    async function handleDisconnectGoogle() {
        await fetch("/api/auth/google-sheets/status", { method: "DELETE" });
        setSheetsConnected(false);
        toast.success("Google account disconnected.");
    }

    async function handleToggleRegistrations() {
        if (!event) return;
        setTogglingRegs(true);
        const result = await toggleRegistrations(id);
        setTogglingRegs(false);
        if (result.success) {
            setEvent((prev) => prev ? { ...prev, registrationsClosed: result.registrationsClosed } as any : prev);
            toast.success(result.registrationsClosed ? "Registrations closed." : "Registrations reopened.");
        } else {
            toast.error((result as any).error ?? "Failed to update.");
        }
    }

    async function handlePublish() {
        if (!event) return;
        setPublishingEvent(true);
        const result = await publishEvent(id);
        setPublishingEvent(false);
        if (result.success) {
            setEvent((prev) => prev ? { ...prev, status: "published" } as any : prev);
            toast.success("Event published.");
        } else {
            toast.error((result as any).error ?? "Failed to publish.");
        }
    }

    async function handleCancel() {
        if (!event) return;
        if (!window.confirm("Cancel this event? This cannot be undone.")) return;
        setCancellingEvent(true);
        const result = await cancelEvent(id);
        setCancellingEvent(false);
        if (result.success) {
            setEvent((prev) => prev ? { ...prev, status: "cancelled" } as any : prev);
            toast.success("Event cancelled.");
        } else {
            toast.error((result as any).error ?? "Failed to cancel.");
        }
    }

    async function handleToggleAttendance(ticketId: string) {
        setTogglingId(ticketId);
        const result = await toggleAttendance(ticketId);
        setTogglingId(null);
        if (result.success) {
            toast.success("Attendance updated.");
            const regsResult = await getEventRegistrations(id);
            if (regsResult.success) setRegistrations(regsResult.data as IRegistration[]);
        } else {
            toast.error(result.error ?? "Failed to update.");
        }
    }

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-6 bg-zinc-100 rounded w-48" />
                <div className="bg-white rounded-xl border border-zinc-200 h-64" />
            </div>
        );
    }

    if (!event) {
        return (
            <div className="text-center py-20">
                <p className="text-zinc-400">Event not found.</p>
                <Link href="/manage/events" className="mt-3 inline-block text-sm text-orange-600 hover:underline">
                    ← Back to events
                </Link>
            </div>
        );
    }

    const confirmed = registrations.filter((r: any) => r.status === "confirmed").length;
    const pending = registrations.filter((r: any) => r.status === "pending").length;
    const hasTeams = (event as any).isTeamEvent;
    const totalParticipants = (registrations as any[]).reduce((sum, r) => {
        return sum + 1 + (r.teamMembers?.length ?? 0);
    }, 0);

    return (
        <div className="space-y-5 max-w-4xl mx-auto">
            {/* Top bar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-1.5 text-sm border rounded-md px-3 py-1.5 text-zinc-500 hover:text-zinc-800 transition-colors"
                >
                    <IconArrowLeft size={16} />
                    Back
                </button>
                <div className="flex items-center gap-2 flex-wrap">
                    {event.status === "draft" && (
                        <button
                            onClick={handlePublish}
                            disabled={publishingEvent}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {publishingEvent ? <IconLoader2 size={15} className="animate-spin" /> : <IconPlayerPlay size={15} />}
                            Publish
                        </button>
                    )}
                    {event.status === "published" && (
                        <>
                            <button
                                onClick={handleToggleRegistrations}
                                disabled={togglingRegs}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
                            >
                                {togglingRegs ? (
                                    <IconLoader2 size={15} className="animate-spin" />
                                ) : event.registrationsClosed ? (
                                    <IconLockOpen size={15} />
                                ) : (
                                    <IconLock size={15} />
                                )}
                                {event.registrationsClosed ? "Reopen Registrations" : "Close Registrations"}
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={cancellingEvent}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                                {cancellingEvent ? <IconLoader2 size={15} className="animate-spin" /> : <IconBan size={15} />}
                                Cancel Event
                            </button>
                        </>
                    )}
                    <Link
                        href={`/manage/events/${id}/edit`}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                    >
                        <IconEdit size={15} />
                        Edit Event
                    </Link>
                </div>
            </div>

            {/* Google Sheets integration */}
            <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                            <IconTableExport size={16} className="text-green-600" />
                            Google Sheets
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            {(event as any).googleSheetId
                                ? "A sheet is linked to this event. Every new registration is appended automatically."
                                : sheetsConnected
                                    ? "Create a sheet in your Google Drive. It will update automatically with every new registration."
                                    : "Connect your Google account to create a live sheet for this event."}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        {(event as any).googleSheetId ? (
                            <>
                                <a
                                    href={`https://docs.google.com/spreadsheets/d/${(event as any).googleSheetId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                                >
                                    <IconExternalLink size={13} />
                                    Open Sheet
                                </a>
                                <button
                                    onClick={handleSyncSheet}
                                    disabled={syncingSheet}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
                                    title="Re-sync all confirmed registrations and the Events Overview tab"
                                >
                                    {syncingSheet ? <IconLoader2 size={13} className="animate-spin" /> : <IconRefresh size={13} />}
                                    {syncingSheet ? "Syncing…" : "Sync Sheet"}
                                </button>
                                <button
                                    onClick={handleUnlinkSheet}
                                    disabled={unlinkingSheet}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
                                    title="Unlink sheet (does not delete the sheet from your Drive)"
                                >
                                    {unlinkingSheet ? <IconLoader2 size={13} className="animate-spin" /> : <IconUnlink size={13} />}
                                    Unlink
                                </button>
                            </>
                        ) : sheetsConnected ? (
                            <>
                                <button
                                    onClick={handleCreateSheet}
                                    disabled={creatingSheet}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {creatingSheet ? <IconLoader2 size={13} className="animate-spin" /> : <IconTableExport size={13} />}
                                    {creatingSheet ? "Creating…" : "Create Sheet"}
                                </button>
                                <button
                                    onClick={handleDisconnectGoogle}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                                    title="Disconnect Google account"
                                >
                                    Disconnect
                                </button>
                            </>
                        ) : (
                            <a
                                href={`/api/auth/google-sheets/connect?returnTo=/manage/events/${id}`}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                            >
                                <IconBrandGoogle size={13} />
                                Connect Google
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {/* Event header card */}
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                {event.coverImage && (
                    <div className="w-full h-48 overflow-hidden">
                        <img src={event.coverImage} alt="" className="w-full h-full object-cover" />
                    </div>
                )}
                <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-bold text-zinc-900">{event.title}</h1>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                    event.status === "published" ? "bg-green-50 text-green-700"
                                        : event.status === "draft" ? "bg-zinc-100 text-zinc-600"
                                            : "bg-red-50 text-red-600"
                                }`}>{event.status}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 capitalize">{event.type}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 capitalize">{event.category}</span>
                                {event.status === "published" && event.registrationsClosed && (
                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 flex items-center gap-1">
                                        <IconLock size={10} />
                                        registrations closed
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-zinc-100">
                        <div className="flex items-center gap-2">
                            <IconCalendarEvent size={16} className="text-zinc-400 shrink-0" />
                            <div>
                                <p className="text-xs text-zinc-400">Date</p>
                                <p className="text-sm font-medium text-zinc-900">
                                    {new Date(event.date.start).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                {" "}
                                {new Date(event.date.start).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                {event.date.end && (
                                    <span className="text-zinc-400 text-xs block">
                                        ends {new Date(event.date.end).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                    </span>
                                )}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <IconMapPin size={16} className="text-zinc-400 shrink-0" />
                            <div>
                                <p className="text-xs text-zinc-400">Venue</p>
                                <p className="text-sm font-medium text-zinc-900 truncate">{event.venue ?? "TBD"}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <IconUsers size={16} className="text-zinc-400 shrink-0" />
                            <div>
                                <p className="text-xs text-zinc-400">Registrations</p>
                                <p className="text-sm font-medium text-zinc-900">
                                    {registrations.length}{event.capacity > 0 ? ` / ${event.capacity}` : ""}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <IconCurrencyRupee size={16} className="text-zinc-400 shrink-0" />
                            <div>
                                <p className="text-xs text-zinc-400">Price</p>
                                <p className="text-sm font-medium text-zinc-900">{event.price === 0 ? "Free" : `₹${event.price}`}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-zinc-200">
                {(["overview", "registrations", ...(isSuperAdmin ? ["activity"] : [])] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                            activeTab === tab
                                ? "border-orange-500 text-orange-600"
                                : "border-transparent text-zinc-500 hover:text-zinc-800"
                        }`}
                    >
                        {tab}
                        {tab === "registrations" && (
                            <span className="ml-1.5 text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full">
                                {registrations.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Overview tab */}
            {activeTab === "overview" && (
                <div className="space-y-4">
                    {event.description && (
                        <div className="bg-white rounded-xl border border-zinc-200 p-5">
                            <h3 className="text-sm font-semibold text-zinc-900 mb-2">Description</h3>
                            <div className="prose prose-sm max-w-none" data-color-mode="light">
                                <MDPreview source={event.description} />
                            </div>
                        </div>
                    )}
                    {event.rules && (
                        <div className="bg-white rounded-xl border border-zinc-200 p-5">
                            <h3 className="text-sm font-semibold text-zinc-900 mb-2">Rules</h3>
                            <div className="prose prose-sm max-w-none" data-color-mode="light">
                                <MDPreview source={event.rules} />
                            </div>
                        </div>
                    )}
                    {(event as any).isTeamEvent && (event as any).teamSize && (
                        <div className="bg-white rounded-xl border border-zinc-200 p-5">
                            <h3 className="text-sm font-semibold text-zinc-900 mb-2">Team Settings</h3>
                            <p className="text-sm text-zinc-600">
                                Team size: {(event as any).teamSize.min} – {(event as any).teamSize.max} members
                            </p>
                        </div>
                    )}
                    {(event as any).registrationInstructions && (
                        <div className="bg-white rounded-xl border border-zinc-200 p-5">
                            <h3 className="text-sm font-semibold text-zinc-900 mb-3">Registration Instructions</h3>
                            <div className="prose prose-sm max-w-none" data-color-mode="light">
                                <MDPreview source={(event as any).registrationInstructions} />
                            </div>
                        </div>
                    )}
                    {event.customForm?.length > 0 && (
                        <div className="bg-white rounded-xl border border-zinc-200 p-5">
                            <h3 className="text-sm font-semibold text-zinc-900 mb-3">Registration Form Fields</h3>
                            <div className="space-y-2">
                                {event.customForm.map((field) => (
                                    <div key={field._id} className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0">
                                        <div>
                                            <p className="text-sm font-medium text-zinc-900">{field.label}</p>
                                            <p className="text-xs text-zinc-400 capitalize">{field.type.replace("_", " ")}</p>
                                        </div>
                                        {field.isRequired && (
                                            <span className="text-xs text-red-500 font-medium">Required</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Activity tab — super_admin only */}
            {activeTab === "activity" && isSuperAdmin && (
                <div className="bg-white rounded-xl border border-zinc-200">
                    <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-100">
                        <IconActivity size={15} className="text-zinc-400" />
                        <p className="text-sm font-semibold text-zinc-900">Edit History</p>
                    </div>
                    {loadingLogs ? (
                        <div className="px-5 py-10 text-center">
                            <IconLoader2 size={20} className="animate-spin text-zinc-300 mx-auto" />
                        </div>
                    ) : auditLogs.length === 0 ? (
                        <div className="px-5 py-10 text-center">
                            <p className="text-sm text-zinc-400">No activity recorded yet.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-zinc-100">
                            {auditLogs.map((log: any) => (
                                <li key={log._id} className="px-5 py-3.5 flex items-start gap-3">
                                    <div className="mt-0.5 w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center shrink-0 text-zinc-500">
                                        {log.action === "create" && <IconPlayerPlay size={13} />}
                                        {log.action === "update" && <IconEdit size={13} />}
                                        {log.action === "publish" && <IconPlayerPlay size={13} className="text-green-600" />}
                                        {log.action === "cancel" && <IconBan size={13} className="text-red-500" />}
                                        {log.action === "delete" && <IconBan size={13} className="text-red-600" />}
                                        {log.action === "toggle_registrations" && <IconLock size={13} className="text-amber-500" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-zinc-800">{log.summary}</p>
                                        <p className="text-xs text-zinc-400 mt-0.5">
                                            {log.userName}
                                            <span className="mx-1.5 text-zinc-300">·</span>
                                            {log.userEmail}
                                            <span className="mx-1.5 text-zinc-300">·</span>
                                            {new Date(log.createdAt).toLocaleString("en-IN", {
                                                day: "numeric", month: "short", year: "numeric",
                                                hour: "2-digit", minute: "2-digit",
                                            })}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Registrations tab */}
            {activeTab === "registrations" && (
                <div className="bg-white rounded-xl border border-zinc-200">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                        <div className="flex items-center gap-4">
                            <p className="text-sm font-semibold text-zinc-900">
                                {registrations.length} Registration{registrations.length !== 1 ? "s" : ""}
                            </p>
                            <span className="text-xs text-zinc-400">
                                {confirmed} confirmed · {pending} pending
                                {hasTeams && totalParticipants !== registrations.length && (
                                    <> · {totalParticipants} total participants</>
                                )}
                            </span>
                        </div>

                        {registrations.length > 0 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => exportGoogleSheetStyleCSV(event, registrations as any[])}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                                >
                                    <IconDownload size={13} />
                                    Export CSV
                                </button>
                            </div>
                        )}
                    </div>

                    {registrations.length === 0 ? (
                        <div className="px-5 py-14 text-center">
                            <p className="text-sm text-zinc-400">No registrations yet.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-100 bg-zinc-50/50">
                                        <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Participant</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">College ID</th>
                                        {hasTeams && (
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Team</th>
                                        )}
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Payment</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Registered At</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {(registrations as any[]).map((reg) => (
                                        <tr key={reg._id} className="hover:bg-zinc-50 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <p className="font-medium text-zinc-900">
                                                    {reg.userId?.name ?? (typeof reg.userId === "string" ? `User ${reg.userId.slice(-6)}` : "—")}
                                                </p>
                                                <p className="text-xs text-zinc-400">{reg.userId?.email ?? "—"}</p>
                                                {reg.isTeamRegistration && reg.teamMembers?.length > 0 && (
                                                    <p className="text-xs text-zinc-400 mt-0.5">
                                                        +{reg.teamMembers.length} teammate{reg.teamMembers.length !== 1 ? "s" : ""}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5 text-zinc-600 text-sm">{reg.userId?.collegeId ?? "—"}</td>
                                            {hasTeams && (
                                                <td className="px-4 py-3.5">
                                                    {reg.isTeamRegistration ? (
                                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                                            Leader
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-zinc-400">Solo</span>
                                                    )}
                                                </td>
                                            )}
                                            <td className="px-4 py-3.5">
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                    reg.status === "confirmed" ? "bg-green-50 text-green-700"
                                                        : reg.status === "pending" ? "bg-yellow-50 text-yellow-700"
                                                            : "bg-red-50 text-red-600"
                                                }`}>{reg.status}</span>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                    reg.paymentStatus === "completed" ? "bg-green-50 text-green-700"
                                                        : reg.paymentStatus === "na" ? "bg-zinc-100 text-zinc-500"
                                                            : reg.paymentStatus === "pending" ? "bg-yellow-50 text-yellow-700"
                                                                : "bg-red-50 text-red-600"
                                                }`}>{reg.paymentStatus}</span>
                                            </td>
                                            <td className="px-4 py-3.5 text-xs text-zinc-400">
                                                {new Date(reg.createdAt).toLocaleDateString("en-IN", {
                                                    day: "numeric", month: "short", year: "numeric",
                                                })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}