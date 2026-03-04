// app/manage/(panel)/events/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getManageEvents } from "@/actions/events";
import { getEventRegistrations, toggleAttendance } from "@/actions/registrations";
import { toast } from "sonner";
import {
    IconEdit, IconArrowLeft, IconCheck, IconX, IconDownload,
    IconCalendarEvent, IconMapPin, IconUsers, IconCurrencyRupee,
} from "@tabler/icons-react";
import type { IEvent, IRegistration } from "@/types";

export default function ManageEventDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [event, setEvent] = useState<IEvent | null>(null);
    const [registrations, setRegistrations] = useState<IRegistration[]>([]);
    const [loading, setLoading] = useState(true);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"overview" | "registrations">("overview");

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const [eventsData, regsResult] = await Promise.all([
                    getManageEvents(),
                    getEventRegistrations(id),
                ]);
                const found = eventsData.find((e) => e._id.toString() === id) ?? null;
                setEvent(found);
                if (regsResult.success) setRegistrations(regsResult.data as IRegistration[]);
            } catch {
                toast.error("Failed to load event.");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);

    async function handleToggleAttendance(ticketId: string) {
        setTogglingId(ticketId);
        const result = await toggleAttendance(ticketId);
        setTogglingId(null);
        if (result.success) {
            toast.success("Attendance updated.");
            // Reload registrations
            const regsResult = await getEventRegistrations(id);
            if (regsResult.success) setRegistrations(regsResult.data as IRegistration[]);
        } else {
            toast.error(result.error ?? "Failed to update.");
        }
    }

    function exportCSV() {
        if (!registrations.length) return;
        const rows = [
            ["Name", "Email", "College ID", "Status", "Payment", "Registered At"],
            ...registrations.map((r: any) => [
                r.userId?.name ?? "—",
                r.userId?.email ?? "—",
                r.userId?.collegeId ?? "—",
                r.status,
                r.paymentStatus,
                new Date(r.createdAt).toLocaleString(),
            ]),
        ];
        const csv = rows.map((row) => row.map((c) => `"${c}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${event?.title ?? "registrations"}.csv`;
        a.click();
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

    return (
        <div className="space-y-5 max-w-4xl">
            {/* Breadcrumb */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
                >
                    <IconArrowLeft size={16} />
                    Back
                </button>
                <Link
                    href={`/manage/events/${id}/edit`}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                >
                    <IconEdit size={15} />
                    Edit Event
                </Link>
            </div>

            {/* Event header */}
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
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${event.status === "published" ? "bg-green-50 text-green-700"
                                        : event.status === "draft" ? "bg-zinc-100 text-zinc-600"
                                            : "bg-red-50 text-red-600"
                                    }`}>{event.status}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 capitalize">{event.type}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 capitalize">{event.category}</span>
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
                                    {event.registrationCount}{event.capacity > 0 ? ` / ${event.capacity}` : ""}
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
                {(["overview", "registrations"] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${activeTab === tab
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

            {activeTab === "overview" && (
                <div className="space-y-4">
                    {event.description && (
                        <div className="bg-white rounded-xl border border-zinc-200 p-5">
                            <h3 className="text-sm font-semibold text-zinc-900 mb-2">Description</h3>
                            <div
                                className="text-sm text-zinc-600 leading-relaxed prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: event.description }}
                            />
                        </div>
                    )}
                    {event.rules && (
                        <div className="bg-white rounded-xl border border-zinc-200 p-5">
                            <h3 className="text-sm font-semibold text-zinc-900 mb-2">Rules</h3>
                            <div
                                className="text-sm text-zinc-600 leading-relaxed prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: event.rules }}
                            />
                        </div>
                    )}
                    {event.isTeamEvent && event.teamSize && (
                        <div className="bg-white rounded-xl border border-zinc-200 p-5">
                            <h3 className="text-sm font-semibold text-zinc-900 mb-2">Team Settings</h3>
                            <p className="text-sm text-zinc-600">
                                Team size: {event.teamSize.min} – {event.teamSize.max} members
                            </p>
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

            {activeTab === "registrations" && (
                <div className="bg-white rounded-xl border border-zinc-200">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                        <div className="flex items-center gap-4">
                            <p className="text-sm font-semibold text-zinc-900">
                                {registrations.length} Registrations
                            </p>
                            <span className="text-xs text-zinc-400">
                                {confirmed} confirmed · {pending} pending
                            </span>
                        </div>
                        {registrations.length > 0 && (
                            <button
                                onClick={exportCSV}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                            >
                                <IconDownload size={13} />
                                Export CSV
                            </button>
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
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Payment</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Attended</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {(registrations as any[]).map((reg) => (
                                        <tr key={reg._id} className="hover:bg-zinc-50 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <p className="font-medium text-zinc-900">{reg.userId?.name ?? "—"}</p>
                                                <p className="text-xs text-zinc-400">{reg.userId?.email ?? "—"}</p>
                                            </td>
                                            <td className="px-4 py-3.5 text-zinc-600">{reg.userId?.collegeId ?? "—"}</td>
                                            <td className="px-4 py-3.5">
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${reg.status === "confirmed" ? "bg-green-50 text-green-700"
                                                        : reg.status === "pending" ? "bg-yellow-50 text-yellow-700"
                                                            : "bg-red-50 text-red-600"
                                                    }`}>{reg.status}</span>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${reg.paymentStatus === "completed" ? "bg-green-50 text-green-700"
                                                        : reg.paymentStatus === "na" ? "bg-zinc-100 text-zinc-500"
                                                            : reg.paymentStatus === "pending" ? "bg-yellow-50 text-yellow-700"
                                                                : "bg-red-50 text-red-600"
                                                    }`}>{reg.paymentStatus}</span>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                {/* Note: toggleAttendance is per-ticket, not registration */}
                                                <span className="text-xs text-zinc-400">Via scanner</span>
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