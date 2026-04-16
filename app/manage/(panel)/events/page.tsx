// app/manage/(panel)/events/page.tsx
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useManageEvents } from "@/hooks/use-manage-events";
import { deleteEvent, publishEvent, cancelEvent, toggleRegistrations, syncAllEventRegistrationCounts } from "@/actions/events";
import { toast } from "sonner";
import {
    IconPlus, IconSearch, IconEdit, IconTrash, IconEye,
    IconDots, IconSend, IconCalendarEvent, IconDownload, IconBan, IconFilter, IconLock, IconLockOpen,
} from "@tabler/icons-react";
import type { IEvent } from "@/types";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [deptFilter, setDeptFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        syncAllEventRegistrationCounts().then(() => refetch()).catch(() => {});
    }, []);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => setSearch(searchInput), 300);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [searchInput]);

    const { departments, categories } = useMemo(() => {
        const deptMap = new Map<string, string>();
        const cats = new Set<string>();
        for (const e of events) {
            const dept = e.department as any;
            if (dept?._id && dept?.name) deptMap.set(String(dept._id), dept.name);
            if (e.category) cats.add(e.category);
        }
        return {
            departments: Array.from(deptMap.entries()).map(([id, name]) => ({ id, name })),
            categories: Array.from(cats).sort(),
        };
    }, [events]);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [publishingId, setPublishingId] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [togglingRegId, setTogglingRegId] = useState<string | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; eventId: string | null; title: string | null }>({
        open: false,
        eventId: null,
        title: null,
    });

    const filtered = events.filter((e) => {
        const matchesTab = activeTab === "all" || e.status === activeTab;
        const matchesSearch = !search || e.title.toLowerCase().includes(search.toLowerCase());
        const dept = e.department as any;
        const deptId = dept?._id ? String(dept._id) : String(e.department);
        const matchesDept = deptFilter === "all" || deptId === deptFilter;
        const matchesType = typeFilter === "all" || e.type === typeFilter;
        const matchesCategory = categoryFilter === "all" || e.category === categoryFilter;
        return matchesTab && matchesSearch && matchesDept && matchesType && matchesCategory;
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

    async function handleToggleRegistrations(id: string) {
        setTogglingRegId(id);
        const result = await toggleRegistrations(id);
        setTogglingRegId(null);
        if (result.success) {
            toast.success(result.registrationsClosed ? "Registrations closed." : "Registrations reopened.");
            refetch();
        } else {
            toast.error((result as any).error ?? "Failed to update registrations.");
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
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-zinc-100">
                    <div className="relative flex-1 min-w-45 max-w-sm">
                        <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Search events…"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                        />
                    </div>
                    <IconFilter size={14} className="text-zinc-400 shrink-0" />
                    {departments.length > 0 && (
                        <Select value={deptFilter} onValueChange={setDeptFilter}>
                            <SelectTrigger className="h-9 text-sm w-40 bg-zinc-50">
                                <SelectValue placeholder="Department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                {departments.map((d) => (
                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="h-9 text-sm w-30 bg-zinc-50">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="inter">Inter</SelectItem>
                            <SelectItem value="intra">Intra</SelectItem>
                        </SelectContent>
                    </Select>
                    {categories.length > 0 && (
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="h-9 text-sm w-35 bg-zinc-50">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {categories.map((c) => (
                                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    {(deptFilter !== "all" || typeFilter !== "all" || categoryFilter !== "all" || search) && (
                        <button
                            onClick={() => { setDeptFilter("all"); setTypeFilter("all"); setCategoryFilter("all"); setSearchInput(""); }}
                            className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors px-2 py-1 rounded hover:bg-zinc-100"
                        >
                            Clear
                        </button>
                    )}
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

                {/* Column headers */}
                <div className="hidden md:flex items-center gap-4 px-5 py-2 border-b border-zinc-100 bg-zinc-50/60">
                    <div className="w-10 shrink-0" />
                    <div className="flex-1 min-w-0 text-xs font-medium text-zinc-400 uppercase tracking-wide">Event</div>
                    <div className="w-20 text-center text-xs font-medium text-zinc-400 uppercase tracking-wide shrink-0">Price</div>
                    <div className="w-20 text-center text-xs font-medium text-zinc-400 uppercase tracking-wide shrink-0">Team</div>
                    <div className="w-24 text-center text-xs font-medium text-zinc-400 uppercase tracking-wide shrink-0">Registrations</div>
                    <div className="w-32 text-xs font-medium text-zinc-400 uppercase tracking-wide shrink-0">Status</div>
                    <div className="w-8 shrink-0" />
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
                                className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50 transition-colors"
                            >
                                {/* Clickable area */}
                                <Link
                                    href={`/manage/events/${event._id}`}
                                    className="flex items-center gap-4 flex-1 min-w-0"
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
                                        </p>
                                    </div>

                                    {/* Price */}
                                    <div className="hidden md:flex w-20 shrink-0 justify-center">
                                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                            event.price === 0
                                                ? "bg-green-50 text-green-700"
                                                : "bg-zinc-100 text-zinc-700"
                                        }`}>
                                            {event.price === 0 ? "Free" : `₹${event.price}`}
                                        </span>
                                    </div>

                                    {/* Team size */}
                                    <div className="hidden md:flex w-20 shrink-0 justify-center">
                                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                                            {event.isTeamEvent && event.teamSize
                                                ? `${event.teamSize.min}–${event.teamSize.max}`
                                                : "Solo"}
                                        </span>
                                    </div>

                                    {/* Registrations */}
                                    <div className="hidden sm:block w-24 shrink-0 text-center">
                                        <p className="text-sm font-semibold text-zinc-900">{event.registrationCount}</p>
                                    </div>

                                    {/* Status */}
                                    <div className="hidden sm:flex w-32 shrink-0 items-center gap-1.5">
                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                                            event.status === "published"
                                                ? "bg-green-50 text-green-700"
                                                : event.status === "draft"
                                                    ? "bg-zinc-100 text-zinc-600"
                                                    : "bg-red-50 text-red-600"
                                        }`}>
                                            {event.status}
                                        </span>
                                        {event.status === "published" && (event as any).registrationsClosed && (
                                            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                                                closed
                                            </span>
                                        )}
                                    </div>
                                </Link>

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
                                            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-zinc-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
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
                                                {event.status === "published" && (
                                                    <button
                                                        onClick={() => { setOpenMenuId(null); handleToggleRegistrations(event._id.toString()); }}
                                                        disabled={togglingRegId === event._id.toString()}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                                                    >
                                                        {(event as any).registrationsClosed
                                                            ? <><IconLockOpen size={15} className="text-zinc-400" />Reopen Registrations</>
                                                            : <><IconLock size={15} className="text-zinc-400" />Close Registrations</>
                                                        }
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