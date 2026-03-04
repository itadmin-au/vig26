// app/manage/(panel)/events/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useManageEvents } from "@/hooks/use-manage-events";
import { deleteEvent, publishEvent } from "@/actions/events";
import { toast } from "sonner";
import {
    IconPlus, IconSearch, IconEdit, IconTrash, IconEye,
    IconDots, IconSend, IconCalendarEvent,
} from "@tabler/icons-react";

const STATUS_TABS = ["all", "published", "draft", "cancelled"] as const;
type StatusTab = typeof STATUS_TABS[number];

export default function ManageEventsPage() {
    const { events, loading, error, refetch } = useManageEvents();
    const [activeTab, setActiveTab] = useState<StatusTab>("all");
    const [search, setSearch] = useState("");
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [publishingId, setPublishingId] = useState<string | null>(null);

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

    async function handleDelete(id: string) {
        if (!confirm("Delete this event? This cannot be undone.")) return;
        setDeletingId(id);
        const result = await deleteEvent(id);
        setDeletingId(null);
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

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Events</h1>
                    <p className="text-sm text-zinc-500 mt-0.5">Manage your department&apos;s events.</p>
                </div>
                <Link
                    href="/manage/events/new"
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    <IconPlus size={16} />
                    New Event
                </Link>
            </div>

            {/* Search + Tabs */}
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
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
                            className={`px-3 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${activeTab === tab
                                    ? "border-orange-500 text-orange-600"
                                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                                }`}
                        >
                            {tab}
                            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab ? "bg-orange-100 text-orange-600" : "bg-zinc-100 text-zinc-500"
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
                                <span className={`hidden sm:inline-flex text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${event.status === "published"
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
                                                <button
                                                    onClick={() => { setOpenMenuId(null); handleDelete(event._id.toString()); }}
                                                    disabled={deletingId === event._id.toString()}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 disabled:opacity-50"
                                                >
                                                    <IconTrash size={15} />
                                                    {deletingId === event._id.toString() ? "Deleting…" : "Delete"}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}