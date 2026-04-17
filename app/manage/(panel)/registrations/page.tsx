"use client";

import { useState, useEffect, useCallback } from "react";
import { getAllRegistrationsAdmin } from "@/actions/admin";
import {
    IconSearch,
    IconDownload,
    IconChevronLeft,
    IconChevronRight,
    IconFilter,
    IconLoader2,
} from "@tabler/icons-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const STATUS_TABS = ["all", "confirmed", "pending", "cancelled"] as const;
type StatusTab = typeof STATUS_TABS[number];

const PAYMENT_OPTIONS = [
    { value: "all", label: "All Payments" },
    { value: "completed", label: "Completed" },
    { value: "pending", label: "Pending" },
    { value: "failed", label: "Failed" },
    { value: "na", label: "N/A (Free)" },
];

function statusBadge(status: string) {
    const cls =
        status === "confirmed" ? "bg-green-50 text-green-700"
            : status === "pending" ? "bg-yellow-50 text-yellow-700"
                : "bg-red-50 text-red-600";
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
}

function paymentBadge(ps: string) {
    const cls =
        ps === "completed" ? "bg-green-50 text-green-700"
            : ps === "pending" ? "bg-yellow-50 text-yellow-700"
                : ps === "na" ? "bg-zinc-100 text-zinc-500"
                    : "bg-red-50 text-red-600";
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{ps}</span>;
}

function downloadCSV(rows: any[]) {
    const headers = [
        "Registration ID", "Name", "Email", "College ID",
        "Event", "Type", "Team ID",
        "Status", "Payment Status", "Transaction ID", "Registered At",
    ];
    const lines = [
        headers.map((h) => `"${h}"`).join(","),
        ...rows.map((r) => [
            r._id,
            r.userId?.name ?? "",
            r.userId?.email ?? "",
            r.userId?.collegeId ?? "",
            r.eventId?.title ?? "",
            r.isTeamRegistration ? "Team" : "Individual",
            r.teamId ?? "",
            r.status,
            r.paymentStatus,
            r.paymentId ?? "",
            new Date(r.createdAt).toLocaleString("en-IN"),
        ].map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registrations_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

export default function RegistrationsPage() {
    const [statusTab, setStatusTab] = useState<StatusTab>("all");
    const [paymentStatus, setPaymentStatus] = useState("all");
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [page, setPage] = useState(1);

    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getAllRegistrationsAdmin({
                page,
                limit: 50,
                status: statusTab === "all" ? undefined : statusTab,
                paymentStatus: paymentStatus === "all" ? undefined : paymentStatus,
                search: search || undefined,
            });
            if (result.success) {
                setData(result.data as any[]);
                setTotal(result.total);
                setTotalPages(result.totalPages);
            }
        } finally {
            setLoading(false);
        }
    }, [page, statusTab, paymentStatus, search]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Reset to page 1 when filters change
    useEffect(() => { setPage(1); }, [statusTab, paymentStatus, search]);

    function handleSearchSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSearch(searchInput);
    }

    return (
        <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Registrations</h1>
                    <p className="text-sm text-zinc-500 mt-0.5">
                        {loading ? "Loading…" : `${total.toLocaleString()} registration${total !== 1 ? "s" : ""}`}
                    </p>
                </div>
                <button
                    onClick={() => downloadCSV(data)}
                    disabled={data.length === 0}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <IconDownload size={15} />
                    Export CSV
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Status tabs */}
                <div className="flex gap-1 bg-zinc-100 p-1 rounded-lg self-start">
                    {STATUS_TABS.map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusTab(s)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${
                                statusTab === s
                                    ? "bg-white text-zinc-900 shadow-sm"
                                    : "text-zinc-500 hover:text-zinc-700"
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2 flex-1">
                    <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                        <SelectTrigger className="w-40 h-9 text-sm bg-white">
                            <IconFilter size={14} className="text-zinc-400 mr-1" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PAYMENT_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
                        <div className="relative flex-1">
                            <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Search by name, email, or USN…"
                                className="w-full pl-8 pr-3 h-9 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                            />
                        </div>
                        <button
                            type="submit"
                            className="px-3 h-9 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                        >
                            Search
                        </button>
                        {search && (
                            <button
                                type="button"
                                onClick={() => { setSearch(""); setSearchInput(""); }}
                                className="px-3 h-9 text-sm font-medium bg-zinc-100 text-zinc-600 rounded-lg hover:bg-zinc-200"
                            >
                                Clear
                            </button>
                        )}
                    </form>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-zinc-200">
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-zinc-400">
                        <IconLoader2 size={20} className="animate-spin mr-2" />
                        Loading…
                    </div>
                ) : data.length === 0 ? (
                    <div className="py-20 text-center text-sm text-zinc-400">No registrations found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-100 bg-zinc-50/50">
                                    <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Participant</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Event</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Type</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Payment</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Transaction ID</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Registered</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {data.map((reg: any) => (
                                    <tr key={reg._id} className="hover:bg-zinc-50 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <p className="font-medium text-zinc-900">{reg.userId?.name ?? "—"}</p>
                                            <p className="text-xs text-zinc-400">{reg.userId?.email ?? "—"}</p>
                                            {reg.userId?.collegeId && (
                                                <p className="text-xs text-zinc-400 font-mono">{reg.userId.collegeId}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5 text-zinc-600 max-w-44">
                                            {reg.eventId?._id ? (
                                                <a
                                                    href={`/manage/events/${reg.eventId._id}`}
                                                    className="hover:text-orange-600 hover:underline line-clamp-2"
                                                >
                                                    {reg.eventId.title}
                                                </a>
                                            ) : "—"}
                                        </td>
                                        <td className="px-4 py-3.5 text-xs text-zinc-500 whitespace-nowrap">
                                            {reg.isTeamRegistration ? (
                                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                                    Team
                                                    {reg.teamId && <span className="text-blue-400 ml-1">#{reg.teamId}</span>}
                                                </span>
                                            ) : (
                                                <span className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-medium">Individual</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5">{statusBadge(reg.status)}</td>
                                        <td className="px-4 py-3.5">{paymentBadge(reg.paymentStatus)}</td>
                                        <td className="px-4 py-3.5 text-xs text-zinc-500 font-mono">
                                            {reg.paymentId ?? "—"}
                                        </td>
                                        <td className="px-4 py-3.5 text-xs text-zinc-400 whitespace-nowrap">
                                            {new Date(reg.createdAt).toLocaleDateString("en-IN", {
                                                day: "numeric", month: "short", year: "numeric",
                                            })}
                                            <br />
                                            <span className="text-zinc-300">
                                                {new Date(reg.createdAt).toLocaleTimeString("en-IN", {
                                                    hour: "2-digit", minute: "2-digit",
                                                })}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100">
                        <p className="text-xs text-zinc-400">
                            Page {page} of {totalPages} — {total.toLocaleString()} total
                        </p>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1 || loading}
                                className="p-1.5 rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <IconChevronLeft size={14} />
                            </button>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages || loading}
                                className="p-1.5 rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <IconChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
