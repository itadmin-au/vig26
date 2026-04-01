// app/manage/(panel)/events/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useManageEvents } from "@/hooks/use-manage-events";
import { deleteEvent, publishEvent, cancelEvent } from "@/actions/events";
import { toast } from "sonner";
import {
    IconPlus, IconSearch, IconEdit, IconTrash, IconEye,
    IconDots, IconSend, IconCalendarEvent, IconDownload, IconBan,
} from "@tabler/icons-react";
import type { IEvent } from "@/types";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_TABS = ["all", "published", "draft", "cancelled"] as const;
type StatusTab = typeof STATUS_TABS[number];

function downloadCSV(filename: string, rows: string[][]) {
    const csv = rows
        .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function exportEventsCSV(events: IEvent[]) {
    if (!events.length) return;

    const rows: string[][] = [
        ["Title", "Type", "Category", "Status", "Department", "Date (Start)", "Date (End)", "Venue", "Price (₹)", "Capacity", "Registrations", "Remaining Slots"],
    ];

    for (const e of events) {
        const dept = typeof e.department === "object" ? (e.department as any)?.name : e.department;
        const capacity = e.capacity === 0 ? "Unlimited" : String(e.capacity);
        const remaining = e.capacity === 0 ? "Unlimited" : String(Math.max(0, e.capacity - e.registrationCount));

        rows.push([
            e.title,
            e.type,
            e.category,
            e.status,
            dept ?? "—",
            e.date?.start ? new Date(e.date.start).toLocaleString("en-IN") : "—",
            e.date?.end ? new Date(e.date.end).toLocaleString("en-IN") : "—",
            e.venue ?? "—",
            e.price === 0 ? "Free" : String(e.price),
            capacity,
            String(e.registrationCount ?? 0),
            remaining,
        ]);
    }

    downloadCSV(`vigyanrang-events-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

export default function ManageEventsPage() {
    const { events, loading, error, refetch } = useManageEvents();
    const [activeTab, setActiveTab] = useState<StatusTab>("all");
    const [search, setSearch] = useState("");
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [publishingId, setPublishingId] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; eventId: string | null; title: string | null }>({
        open: false,
        eventId: null,
        title: null,
    });

    const filtered = events.filter((e) => {
        const matchesTab = activeTab === "all" || e.status === activeTab;
        const matchesSearch = !search || e.title.toLowerCase().includes(search.toLowerCase());
        return matchesTab && matchesSearch;
    });

    const counts = {
        all: events.length,
        published: events.filter((e) => e.status === "published").length,
        draft: events.filter((e) => e.status === "draft").length,
        cancelled: events.filter((e) => e.status === "cancelled").length,
    };

    function openDeleteDialog(id: string, title: string) {
        setDeleteDialog({ open: true, eventId: id, title });
    }

    async function handleDelete() {
        if (!deleteDialog.eventId) return;
        setDeletingId(deleteDialog.eventId);
        const result = await deleteEvent(deleteDialog.eventId);
        setDeletingId(null);
        setDeleteDialog({ open: false, eventId: null, title: null });
        if (result.success) {
            toast.success("Event deleted.");
            refetch();
        } else {
            toast.error(result.error ?? "Failed to delete event.");
        }
    }

    async function handlePublish(id: string) {
        setPublishingId(id);
        const result = await publishEvent(id);
        setPublishingId(null);
        if (result.success) {
            toast.success("Event published.");
            refetch();
        } else {
            toast.error(result.error ?? "Failed to publish event.");
        }
    }

    async function handleCancel(id: string) {
        setCancellingId(id);
        const result = await cancelEvent(id);
        setCancellingId(null);
        if (result.success) {
            toast.success("Event cancelled.");
            refetch();
        } else {
            toast.error(result.error ?? "Failed to cancel event.");
        }
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Events</h1>
                    <p className="text-sm text-zinc-500 mt-0.5">Manage your department&apos;s events.</p>
                </div>
                <div className="flex items-center gap-2">
                    {filtered.length > 0 && !loading && (
                        <button
                            onClick={() => exportEventsCSV(filtered)}
                            className="flex items-center gap-2 px-3 py-2 border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm font-medium rounded-lg transition-colors"
                            title={`Export ${filtered.length} event${filtered.length !== 1 ? "s" : ""} as CSV`}
                        >
                            <IconDownload size={15} />
                            Export{activeTab !== "all" ? ` ${activeTab}` : ""} ({filtered.length})
                        </button>
                    )}
                    <Link
                        href="/manage/events/new"
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <IconPlus size={16} />
                        New Event
                    </Link>
                </div>
            </div>

            {/* Search + Tabs */}
            <div className="bg-white rounded-xl border border-zinc-200">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
                    <div className="relative flex-1 max-w-sm">
                        <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Search events…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                        />
                    </div>
                </div>

                {/* Status tabs */}
                <div className="flex border-b border-zinc-100 px-4 gap-1">
                    {STATUS_TABS.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                                activeTab === tab
                                    ? "border-orange-500 text-orange-600"
                                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                            }`}
                        >
                            {tab}
                            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                                activeTab === tab ? "bg-orange-100 text-orange-600" : "bg-zinc-100 text-zinc-500"
                            }`}>
                                {counts[tab]}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Events Table */}
                {loading ? (
                    <div className="divide-y divide-zinc-100">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                                <div className="w-10 h-10 rounded-lg bg-zinc-100 shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-zinc-100 rounded w-48" />
                                    <div className="h-3 bg-zinc-100 rounded w-32" />
                                </div>
                                <div className="h-5 bg-zinc-100 rounded-full w-16" />
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="px-5 py-10 text-center text-sm text-red-500">{error}</div>
                ) : filtered.length === 0 ? (
                    <div className="px-5 py-14 text-center">
                        <IconCalendarEvent size={40} className="mx-auto text-zinc-200 mb-3" />
                        <p className="text-sm text-zinc-400">
                            {search ? "No events match your search." : "No events here yet."}
                        </p>
                        {!search && (
                            <Link
                                href="/manage/events/new"
                                className="mt-3 inline-block text-sm text-orange-600 font-medium hover:underline"
                            >
                                Create your first event →
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-100">
                        {filtered.map((event) => (
                            <div
                                key={event._id.toString()}
                                className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors"
                            >
                                {/* Cover */}
                                <div className="w-10 h-10 rounded-lg bg-zinc-100 shrink-0 overflow-hidden">
                                    {event.coverImage ? (
                                        <img src={event.coverImage} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <IconCalendarEvent size={18} className="text-zinc-300" />
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-900 truncate">{event.title}</p>
                                    <p className="text-xs text-zinc-400 mt-0.5">
                                        {new Date(event.date.start).toLocaleDateString("en-IN", {
                                            day: "numeric", month: "short", year: "numeric",
                                        })}
                                        {" · "}
                                        <span className="capitalize">{event.type}</span>
                                        {" · "}
                                        <span className="capitalize">{event.category}</span>
                                        {event.price === 0 ? " · Free" : ` · ₹${event.price}`}
                                    </p>
                                </div>

                                {/* Registrations */}
                                <div className="hidden sm:block text-center shrink-0">
                                    <p className="text-sm font-semibold text-zinc-900">{event.registrationCount}</p>
                                    <p className="text-xs text-zinc-400">registrations</p>
                                </div>

                                {/* Status badge */}
                                <span className={`hidden sm:inline-flex text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
                                    event.status === "published"
                                        ? "bg-green-50 text-green-700"
                                        : event.status === "draft"
                                            ? "bg-zinc-100 text-zinc-600"
                                            : "bg-red-50 text-red-600"
                                }`}>
                                    {event.status}
                                </span>

                                {/* Actions menu */}
                                <div className="relative shrink-0">
                                    <button
                                        onClick={() => setOpenMenuId(openMenuId === event._id.toString() ? null : event._id.toString())}
                                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                                    >
                                        <IconDots size={17} />
                                    </button>
                                    {openMenuId === event._id.toString() && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                                            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-zinc-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                                                <Link
                                                    href={`/manage/events/${event._id}`}
                                                    onClick={() => setOpenMenuId(null)}
                                                    className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                                                >
                                                    <IconEye size={15} className="text-zinc-400" />
                                                    View
                                                </Link>
                                                <Link
                                                    href={`/manage/events/${event._id}/edit`}
                                                    onClick={() => setOpenMenuId(null)}
                                                    className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                                                >
                                                    <IconEdit size={15} className="text-zinc-400" />
                                                    Edit
                                                </Link>
                                                {event.status === "draft" && (
                                                    <button
                                                        onClick={() => { setOpenMenuId(null); handlePublish(event._id.toString()); }}
                                                        disabled={publishingId === event._id.toString()}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                                                    >
                                                        <IconSend size={15} className="text-zinc-400" />
                                                        {publishingId === event._id.toString() ? "Publishing…" : "Publish"}
                                                    </button>
                                                )}
                                                <div className="my-1 border-t border-zinc-100" />
                                                {event.status === "published" ? (
                                                    <button
                                                        onClick={() => { setOpenMenuId(null); handleCancel(event._id.toString()); }}
                                                        disabled={cancellingId === event._id.toString()}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-orange-500 hover:bg-orange-50 disabled:opacity-50"
                                                    >
                                                        <IconBan size={15} />
                                                        {cancellingId === event._id.toString() ? "Cancelling…" : "Cancel Event"}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setOpenMenuId(null);
                                                            openDeleteDialog(event._id.toString(), event.title);
                                                        }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                                                    >
                                                        <IconTrash size={15} />
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <AlertDialog
                open={deleteDialog.open}
                onOpenChange={(open) =>
                    setDeleteDialog((prev) => ({
                        ...prev,
                        open,
                        ...(open ? {} : { eventId: null, title: null }),
                    }))
                }
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this event?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteDialog.title ? (
                                <span>
                                    You are about to delete <strong>{deleteDialog.title}</strong>. This action cannot be
                                    undone and will remove all associated registrations.
                                </span>
                            ) : (
                                "This action cannot be undone."
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            disabled={deletingId === deleteDialog.eventId}
                            onClick={() => setDeleteDialog({ open: false, eventId: null, title: null })}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={!deleteDialog.eventId || deletingId === deleteDialog.eventId}
                        >
                            {deletingId === deleteDialog.eventId ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}