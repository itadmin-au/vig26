// app/events/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useEvents } from "@/hooks/use-events";
import { getCategories } from "@/actions/events";
import {
    IconSearch, IconCalendarEvent, IconMapPin,
    IconUsers, IconX, IconLoader2,
} from "@tabler/icons-react";
import type { IEvent } from "@/types";

const EVENT_TYPES = [
    { value: "", label: "All" },
    { value: "inter", label: "Inter College" },
    { value: "intra", label: "Intra College" },
] as const;

function CategoryBadge({ category }: { category: string }) {
    const colors: Record<string, string> = {
        tech: "bg-blue-50 text-blue-700",
        cultural: "bg-purple-50 text-purple-700",
        workshop: "bg-amber-50 text-amber-700",
        hackathon: "bg-green-50 text-green-700",
        esports: "bg-indigo-50 text-indigo-700",
        sports: "bg-rose-50 text-rose-700",
    };
    const cls = colors[category] ?? "bg-zinc-100 text-zinc-600";
    return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${cls}`}>
            {category}
        </span>
    );
}

function EventCard({ event }: { event: IEvent }) {
    const start = new Date(event.date.start);
    const slotsLeft = event.capacity > 0 ? event.capacity - event.registrationCount : null;
    const isFull = slotsLeft !== null && slotsLeft <= 0;

    return (
        <Link
            href={`/events/${event.slug}`}
            className="group bg-white rounded-2xl border border-zinc-200 overflow-hidden hover:border-zinc-300 hover:shadow-md transition-all duration-200 flex flex-col"
        >
            <div className="relative w-full h-44 bg-zinc-100 overflow-hidden">
                {event.coverImage ? (
                    <img
                        src={event.coverImage}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <IconCalendarEvent size={40} className="text-zinc-200" />
                    </div>
                )}
                <div className="absolute top-3 right-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm ${event.price === 0
                            ? "bg-green-500 text-white"
                            : "bg-white text-zinc-900 border border-zinc-200"
                        }`}>
                        {event.price === 0 ? "Free" : `₹${event.price}`}
                    </span>
                </div>
                {isFull && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white text-sm font-bold bg-black/60 px-3 py-1 rounded-full">
                            Fully Booked
                        </span>
                    </div>
                )}
            </div>

            <div className="p-4 flex flex-col flex-1">
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    <CategoryBadge category={event.category} />
                    <span className="text-xs text-zinc-400 capitalize">{event.type}</span>
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 leading-snug line-clamp-2 group-hover:text-orange-600 transition-colors">
                    {event.title}
                </h3>
                <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2 mt-auto">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400 min-w-0">
                        <IconCalendarEvent size={13} className="shrink-0" />
                        <span className="truncate">
                            {start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                    </div>
                    {event.venue && (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400 min-w-0">
                            <IconMapPin size={13} className="shrink-0" />
                            <span className="truncate">{event.venue}</span>
                        </div>
                    )}
                    {slotsLeft !== null && !isFull && (
                        <div className="flex items-center gap-1 text-xs text-zinc-400 shrink-0">
                            <IconUsers size={13} />
                            <span>{slotsLeft} left</span>
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}

function EventCardSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden animate-pulse">
            <div className="w-full h-44 bg-zinc-100" />
            <div className="p-4 space-y-3">
                <div className="flex gap-2">
                    <div className="h-5 w-16 bg-zinc-100 rounded-full" />
                    <div className="h-5 w-10 bg-zinc-100 rounded-full" />
                </div>
                <div className="h-4 bg-zinc-100 rounded w-3/4" />
                <div className="h-4 bg-zinc-100 rounded w-1/2" />
                <div className="h-3 bg-zinc-100 rounded w-1/3 mt-4" />
            </div>
        </div>
    );
}

export default function EventsPage() {
    const [categories, setCategories] = useState<string[]>([]);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

    const { events, total, hasMore, loading, filters, updateFilters, nextPage } = useEvents({ page: 1, limit: 12 });

    useEffect(() => {
        getCategories().then((cats: any[]) => {
            setCategories(cats.map((c) => c.slug));
        }).catch(() => { });
    }, []);

    useEffect(() => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(search);
        }, 350);
        return () => clearTimeout(debounceRef.current);
    }, [search]);

    useEffect(() => {
        updateFilters({ search: debouncedSearch || undefined });
    }, [debouncedSearch]);

    const hasActiveFilters = filters.type || filters.category || filters.search;

    return (
        <div className="min-h-screen bg-zinc-50 pt-16">
            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-zinc-900">Events</h1>
                    <p className="text-sm text-zinc-500 mt-0.5">
                        {total > 0 ? `${total} event${total !== 1 ? "s" : ""} available` : "Discover what's happening at Vigyanrang"}
                    </p>
                </div>

                <div className="bg-white rounded-2xl border border-zinc-200 p-4 mb-6 space-y-3">
                    <div className="relative">
                        <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search events…"
                            className="w-full pl-9 pr-9 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-colors"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                            >
                                <IconX size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {EVENT_TYPES.map((t) => (
                            <button
                                key={t.value}
                                onClick={() => updateFilters({ type: t.value as any || undefined })}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${(filters.type ?? "") === t.value
                                        ? "bg-zinc-900 text-white border-zinc-900"
                                        : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}

                        <div className="w-px bg-zinc-200 mx-1 self-stretch" />

                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => updateFilters({ category: filters.category === cat ? undefined : cat })}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full border capitalize transition-colors ${filters.category === cat
                                        ? "bg-orange-500 text-white border-orange-500"
                                        : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}

                        {hasActiveFilters && (
                            <button
                                onClick={() => { setSearch(""); updateFilters({ type: undefined, category: undefined, search: undefined }); }}
                                className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-full hover:bg-red-50 transition-colors flex items-center gap-1"
                            >
                                <IconX size={12} />
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>

                {loading && events.length === 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[...Array(6)].map((_, i) => <EventCardSkeleton key={i} />)}
                    </div>
                ) : events.length === 0 ? (
                    <div className="text-center py-24">
                        <IconCalendarEvent size={48} className="mx-auto text-zinc-200 mb-4" />
                        <p className="text-zinc-500 font-medium">No events found</p>
                        <p className="text-sm text-zinc-400 mt-1">
                            {hasActiveFilters ? "Try adjusting your filters." : "Check back soon!"}
                        </p>
                        {hasActiveFilters && (
                            <button
                                onClick={() => { setSearch(""); updateFilters({ type: undefined, category: undefined, search: undefined }); }}
                                className="mt-4 text-sm text-orange-600 font-medium hover:underline"
                            >
                                Clear all filters
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {events.map((event) => (
                                <EventCard key={event._id.toString()} event={event} />
                            ))}
                        </div>

                        {hasMore && (
                            <div className="mt-10 text-center">
                                <button
                                    onClick={nextPage}
                                    disabled={loading}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                                >
                                    {loading ? (
                                        <>
                                            <IconLoader2 size={15} className="animate-spin" />
                                            Loading…
                                        </>
                                    ) : (
                                        "Load more events"
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}