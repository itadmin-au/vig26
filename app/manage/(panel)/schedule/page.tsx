// app/manage/(panel)/schedule/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { getAllEventsForSchedule } from "@/actions/events";
import type { IEvent } from "@/types";
import { IconCalendarEvent, IconMapPin, IconFilter } from "@tabler/icons-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// ─── Colour palette ────────────────────────────────────────────────────────────
const PALETTE = [
    { bg: "bg-orange-100 border-orange-300", text: "text-orange-800", bar: "#fb923c" },
    { bg: "bg-blue-100 border-blue-300", text: "text-blue-800", bar: "#60a5fa" },
    { bg: "bg-emerald-100 border-emerald-300", text: "text-emerald-800", bar: "#34d399" },
    { bg: "bg-violet-100 border-violet-300", text: "text-violet-800", bar: "#a78bfa" },
    { bg: "bg-pink-100 border-pink-300", text: "text-pink-800", bar: "#f472b6" },
    { bg: "bg-amber-100 border-amber-300", text: "text-amber-800", bar: "#fbbf24" },
    { bg: "bg-cyan-100 border-cyan-300", text: "text-cyan-800", bar: "#22d3ee" },
    { bg: "bg-lime-100 border-lime-300", text: "text-lime-800", bar: "#a3e635" },
    { bg: "bg-rose-100 border-rose-300", text: "text-rose-800", bar: "#fb7185" },
    { bg: "bg-indigo-100 border-indigo-300", text: "text-indigo-800", bar: "#818cf8" },
];

function deptColor(deptId: string, deptColorMap: Map<string, number>) {
    const idx = deptColorMap.get(deptId) ?? 0;
    return PALETTE[idx % PALETTE.length];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toDateKey(date: Date): string {
    // Returns YYYY-MM-DD in IST
    return new Date(date).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function formatDateLabel(key: string): string {
    const d = new Date(key + "T00:00:00+05:30");
    return d.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
    });
}

/** Minutes elapsed from the start of `dayKey` (IST midnight) to `date`. Can be negative or > 1440 for multi-day events. */
function toMinutesFromDayStart(date: Date, dayKey: string): number {
    const dayStartMs = new Date(dayKey + "T00:00:00+05:30").getTime();
    return (new Date(date).getTime() - dayStartMs) / (60 * 1000);
}


function formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata",
    });
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ScheduleRound {
    _id: string;
    label: string;
    start: Date;
    end: Date;
    venue?: string;
}

interface ScheduleEvent {
    _id: string;
    title: string;
    venue: string;
    start: Date;
    end: Date;
    deptId: string;
    deptName: string;
    status: string;
    category: string;
    registrationCount: number;
    rounds: ScheduleRound[];
}

/** A flat displayable bar — either an event or one of its rounds */
interface GanttItem {
    id: string;
    label: string;
    start: Date;
    end: Date;
    venue: string;
    deptId: string;
    deptName: string;
    status: string;
    category: string;
    registrationCount: number;
    isRound: boolean;
    parentTitle: string;
}

// Assign overlapping items into sub-rows
function layoutRows(items: GanttItem[]): GanttItem[][] {
    const rows: GanttItem[][] = [];
    const rowEnds: number[] = [];

    for (const item of items) {
        const start = new Date(item.start).getTime();
        const end = new Date(item.end).getTime();
        let placed = false;
        for (let i = 0; i < rows.length; i++) {
            if (rowEnds[i] <= start) {
                rows[i].push(item);
                rowEnds[i] = end;
                placed = true;
                break;
            }
        }
        if (!placed) {
            rows.push([item]);
            rowEnds.push(end);
        }
    }
    return rows;
}

/** Expand a ScheduleEvent into flat GanttItems (one per round, or one for the event itself). */
function expandToItems(ev: ScheduleEvent): GanttItem[] {
    if (ev.rounds.length > 0) {
        return ev.rounds.map((r) => ({
            id: `${ev._id}__${r._id}`,
            label: ev.rounds.length === 1 ? ev.title : `${ev.title} — ${r.label}`,
            start: r.start,
            end: r.end,
            venue: r.venue || ev.venue || "No Venue",
            deptId: ev.deptId,
            deptName: ev.deptName,
            status: ev.status,
            category: ev.category,
            registrationCount: ev.registrationCount,
            isRound: true,
            parentTitle: ev.title,
        }));
    }
    return [{
        id: ev._id,
        label: ev.title,
        start: ev.start,
        end: ev.end,
        venue: ev.venue || "No Venue",
        deptId: ev.deptId,
        deptName: ev.deptName,
        status: ev.status,
        category: ev.category,
        registrationCount: ev.registrationCount,
        isRound: false,
        parentTitle: ev.title,
    }];
}

// ─── Gantt Row ─────────────────────────────────────────────────────────────────

function GanttBar({
    item,
    dateKey,
    dayStartMin,
    dayEndMin,
    totalMins,
    color,
}: {
    item: GanttItem;
    dateKey: string;
    dayStartMin: number;
    dayEndMin: number;
    totalMins: number;
    color: ReturnType<typeof deptColor>;
}) {
    const startMin = Math.max(toMinutesFromDayStart(item.start, dateKey), dayStartMin);
    const endMin = Math.min(toMinutesFromDayStart(item.end, dateKey), dayEndMin);
    const left = ((startMin - dayStartMin) / totalMins) * 100;
    const width = Math.max(((endMin - startMin) / totalMins) * 100, 1.5);

    return (
        <div
            className="absolute top-1 bottom-1 rounded-md border flex items-center px-2 overflow-hidden cursor-default group"
            style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color.bar + "33", borderColor: color.bar }}
            title={`${item.label}\n${formatTime(item.start)} – ${formatTime(item.end)}\n${item.deptName}`}
        >
            <span className="text-xs font-medium truncate text-zinc-800 select-none">
                {item.label}
            </span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 hidden group-hover:flex flex-col bg-zinc-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl w-max max-w-xs pointer-events-none">
                <span className="font-semibold">{item.label}</span>
                <span className="text-zinc-300 mt-0.5">{formatTime(item.start)} – {formatTime(item.end)}</span>
                <span className="text-zinc-400">{item.deptName} · {item.category}</span>
                {item.registrationCount > 0 && (
                    <span className="text-zinc-400">{item.registrationCount} registrations</span>
                )}
                <span className={`mt-1 capitalize font-medium ${item.status === "published" ? "text-emerald-400" : item.status === "cancelled" ? "text-red-400" : "text-zinc-400"}`}>
                    {item.status}
                </span>
            </div>
        </div>
    );
}

// ─── Day Gantt ─────────────────────────────────────────────────────────────────

function DayGantt({
    dateKey,
    events,
    deptColorMap,
}: {
    dateKey: string;
    events: ScheduleEvent[];
    deptColorMap: Map<string, number>;
}) {
    // Expand events → flat GanttItems, keeping only items that start on this day.
    // Rounds from other days are filtered out here so they don't stretch the time axis.
    const allItems = events.flatMap(expandToItems).filter((item) => {
        const m = toMinutesFromDayStart(item.start, dateKey);
        return m >= 0 && m < 24 * 60;
    });

    // Time range: derive from all items (they're all on this day now).
    const itemsStartingToday = allItems;
    const rangeMins = (itemsStartingToday.length > 0 ? itemsStartingToday : allItems).flatMap((item) => [
        toMinutesFromDayStart(item.start, dateKey),
        Math.min(toMinutesFromDayStart(item.end, dateKey), 24 * 60),
    ]);
    const rawStart = Math.min(...rangeMins);
    const rawEnd = Math.max(...rangeMins);
    // 1-hour buffer each side, clamped to [0, 1440]
    const dayStartMin = Math.max(0, Math.floor(rawStart / 60) * 60 - 60);
    const dayEndMin = Math.min(24 * 60, Math.ceil(rawEnd / 60) * 60 + 60);
    const totalMins = dayEndMin - dayStartMin;

    // Hour markers
    const hourMarkers: number[] = [];
    for (let h = Math.ceil(dayStartMin / 60); h <= Math.floor(dayEndMin / 60); h++) {
        hourMarkers.push(h);
    }

    // Group items by venue
    const venueMap = new Map<string, GanttItem[]>();
    for (const item of allItems) {
        const arr = venueMap.get(item.venue) ?? [];
        arr.push(item);
        venueMap.set(item.venue, arr);
    }
    const venues = Array.from(venueMap.entries()).sort(([a], [b]) =>
        a === "No Venue" ? 1 : b === "No Venue" ? -1 : a.localeCompare(b)
    );

    const LABEL_W = 140;

    return (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100">
                <h2 className="text-base font-semibold text-zinc-800">{formatDateLabel(dateKey)}</h2>
                <p className="text-xs text-zinc-400 mt-0.5">{events.length} event{events.length !== 1 ? "s" : ""}</p>
            </div>

            <div className="overflow-x-auto">
                <div style={{ minWidth: 600 }}>
                    {/* Time axis header */}
                    <div className="flex border-b border-zinc-100 bg-zinc-50">
                        <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="shrink-0 px-3 py-2 text-xs font-medium text-zinc-500 border-r border-zinc-100">
                            Venue
                        </div>
                        <div className="flex-1 relative h-8">
                            {hourMarkers.map((h) => {
                                const left = ((h * 60 - dayStartMin) / totalMins) * 100;
                                return (
                                    <div key={h} className="absolute top-0 h-full flex items-center" style={{ left: `${left}%` }}>
                                        <span className="text-xs text-zinc-400 -translate-x-1/2 select-none whitespace-nowrap">
                                            {String(h).padStart(2, "0")}:00
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Venue rows */}
                    {venues.map(([venue, venueItems]) => {
                        const sorted = [...venueItems].sort(
                            (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
                        );
                        const subRows = layoutRows(sorted);

                        return (
                            <div key={venue} className="border-b border-zinc-100 last:border-b-0">
                                {subRows.map((rowItems, rowIdx) => (
                                    <div key={rowIdx} className="flex" style={{ minHeight: 44 }}>
                                        <div
                                            style={{ width: LABEL_W, minWidth: LABEL_W }}
                                            className="shrink-0 border-r border-zinc-100 px-3 flex items-center gap-1.5 bg-zinc-50/50"
                                        >
                                            {rowIdx === 0 && (
                                                <>
                                                    <IconMapPin size={12} className="text-zinc-400 shrink-0" />
                                                    <span className="text-xs font-medium text-zinc-700 truncate" title={venue}>
                                                        {venue}
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        <div className="flex-1 relative">
                                            {hourMarkers.map((h) => (
                                                <div
                                                    key={h}
                                                    className="absolute top-0 bottom-0 border-l border-zinc-100"
                                                    style={{ left: `${((h * 60 - dayStartMin) / totalMins) * 100}%` }}
                                                />
                                            ))}
                                            {rowItems.map((item) => (
                                                <GanttBar
                                                    key={item.id}
                                                    item={item}
                                                    dateKey={dateKey}
                                                    dayStartMin={dayStartMin}
                                                    dayEndMin={dayEndMin}
                                                    totalMins={totalMins}
                                                    color={deptColor(item.deptId, deptColorMap)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SchedulePage() {
    const [events, setEvents] = useState<ScheduleEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>("published");
    const [deptFilter, setDeptFilter] = useState<string>("all");
    const [activeDate, setActiveDate] = useState<string | null>(null);

    useEffect(() => {
        getAllEventsForSchedule()
            .then((raw) => {
                const mapped: ScheduleEvent[] = raw.map((e) => {
                    const dept = e.department as any;
                    return {
                        _id: e._id.toString(),
                        title: e.title,
                        venue: e.venue ?? "",
                        start: new Date(e.date.start),
                        end: new Date(e.date.end),
                        deptId: dept?._id ? String(dept._id) : String(e.department),
                        deptName: dept?.name ?? "Unknown",
                        status: e.status,
                        category: e.category,
                        registrationCount: e.registrationCount,
                        rounds: (e.rounds ?? []).map((r: any) => ({
                            _id: String(r._id),
                            label: r.label,
                            start: new Date(r.start),
                            end: new Date(r.end),
                            venue: r.venue ?? undefined,
                        })),
                    };
                });
                setEvents(mapped);
            })
            .catch((err) => setError(err.message ?? "Failed to load events."))
            .finally(() => setLoading(false));
    }, []);

    // Build dept color map
    const deptColorMap = useMemo(() => {
        const map = new Map<string, number>();
        let idx = 0;
        for (const ev of events) {
            if (!map.has(ev.deptId)) {
                map.set(ev.deptId, idx++);
            }
        }
        return map;
    }, [events]);

    // Department list for filter
    const departments = useMemo(() => {
        const seen = new Map<string, string>();
        for (const ev of events) seen.set(ev.deptId, ev.deptName);
        return Array.from(seen.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [events]);

    // Apply filters
    const filtered = useMemo(() => {
        return events.filter((e) => {
            const matchStatus = statusFilter === "all" || e.status === statusFilter;
            const matchDept = deptFilter === "all" || e.deptId === deptFilter;
            return matchStatus && matchDept;
        });
    }, [events, statusFilter, deptFilter]);

    // Group by date — events with rounds appear on the days their rounds start;
    // events without rounds appear on their event start day.
    const byDate = useMemo(() => {
        const map = new Map<string, ScheduleEvent[]>();
        for (const ev of filtered) {
            const days = new Set<string>();
            if (ev.rounds.length > 0) {
                for (const r of ev.rounds) days.add(toDateKey(r.start));
            } else {
                days.add(toDateKey(ev.start));
            }
            for (const key of days) {
                const arr = map.get(key) ?? [];
                if (!arr.includes(ev)) arr.push(ev);
                map.set(key, arr);
            }
        }
        return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
    }, [filtered]);

    const dateKeys = Array.from(byDate.keys());

    // Set initial active date tab
    useEffect(() => {
        if (dateKeys.length > 0 && (activeDate === null || !dateKeys.includes(activeDate))) {
            setActiveDate(dateKeys[0]);
        }
    }, [dateKeys.join(",")]);

    // Department legend
    const legend = useMemo(() => {
        const seen = new Map<string, string>();
        for (const ev of filtered) if (!seen.has(ev.deptId)) seen.set(ev.deptId, ev.deptName);
        return Array.from(seen.entries()).map(([id, name]) => ({
            id,
            name,
            color: PALETTE[(deptColorMap.get(id) ?? 0) % PALETTE.length],
        }));
    }, [filtered, deptColorMap]);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Schedule</h1>
                    <p className="text-sm text-zinc-500 mt-0.5">Gantt view of all events across all departments.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <IconFilter size={14} className="text-zinc-400 shrink-0" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 text-sm w-38 bg-white">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                </Select>
                {departments.length > 0 && (
                    <Select value={deptFilter} onValueChange={setDeptFilter}>
                        <SelectTrigger className="h-9 text-sm w-44 bg-white">
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
                {(statusFilter !== "published" || deptFilter !== "all") && (
                    <button
                        onClick={() => { setStatusFilter("published"); setDeptFilter("all"); }}
                        className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors px-2 py-1 rounded hover:bg-zinc-100"
                    >
                        Reset
                    </button>
                )}
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[...Array(2)].map((_, i) => (
                        <div key={i} className="bg-white rounded-xl border border-zinc-200 animate-pulse">
                            <div className="px-5 py-4 border-b border-zinc-100">
                                <div className="h-4 bg-zinc-100 rounded w-48 mb-2" />
                                <div className="h-3 bg-zinc-100 rounded w-24" />
                            </div>
                            <div className="p-5 space-y-3">
                                {[...Array(3)].map((_, j) => (
                                    <div key={j} className="h-10 bg-zinc-100 rounded-lg" />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="bg-white rounded-xl border border-zinc-200 px-5 py-16 text-center text-sm text-red-500">{error}</div>
            ) : dateKeys.length === 0 ? (
                <div className="bg-white rounded-xl border border-zinc-200 px-5 py-16 text-center">
                    <IconCalendarEvent size={40} className="mx-auto text-zinc-200 mb-3" />
                    <p className="text-sm text-zinc-400">No events match the current filters.</p>
                </div>
            ) : (
                <>
                    {/* Department legend */}
                    {legend.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {legend.map((l) => (
                                <div
                                    key={l.id}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium cursor-pointer"
                                    style={{ backgroundColor: l.color.bar + "22", borderColor: l.color.bar, color: "#333" }}
                                    onClick={() => setDeptFilter(deptFilter === l.id ? "all" : l.id)}
                                    title="Click to filter by department"
                                >
                                    <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: l.color.bar }}
                                    />
                                    {l.name}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Date tabs */}
                    <div className="flex gap-1 flex-wrap">
                        {dateKeys.map((key) => (
                            <button
                                key={key}
                                onClick={() => setActiveDate(key)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                                    activeDate === key
                                        ? "bg-orange-50 text-orange-600 border-orange-200"
                                        : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                                }`}
                            >
                                {new Date(key + "T00:00:00+05:30").toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    timeZone: "Asia/Kolkata",
                                })}
                                <span className="ml-2 text-xs opacity-60">
                                    {byDate.get(key)!.length}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Gantt for active date */}
                    {activeDate && byDate.has(activeDate) && (
                        <DayGantt
                            key={activeDate}
                            dateKey={activeDate}
                            events={byDate.get(activeDate)!}
                            deptColorMap={deptColorMap}
                        />
                    )}
                </>
            )}
        </div>
    );
}
