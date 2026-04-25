// app/manage/(panel)/analytics/page.tsx
import { getAnalytics } from "@/actions/admin";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { DownloadReportButton } from "./DownloadReportButton";

export default async function ManageAnalyticsPage() {
    try {
        await requireSuperAdmin();
    } catch {
        redirect("/manage/dashboard");
    }

    const result = await getAnalytics();
    const data = result.success ? result.data : null;

    return (
        <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Analytics</h1>
                    <p className="text-sm text-zinc-500 mt-0.5">Platform-wide stats and performance.</p>
                </div>
                <DownloadReportButton />
            </div>

            {!data ? (
                <div className="bg-white rounded-xl border border-zinc-200 p-10 text-center text-sm text-zinc-400">
                    Failed to load analytics.
                </div>
            ) : (
                <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: "Total Events", value: data.totalEvents },
                            { label: "Published Events", value: data.publishedEvents },
                            { label: "Total Registrations", value: data.totalRegistrations },
                            { label: "Confirmed Registrations", value: data.confirmedRegistrations },
                            { label: "Total Revenue", value: `₹${data.totalRevenue?.toLocaleString() ?? 0}`, span: true },
                        ].map((stat) => (
                            <div
                                key={stat.label}
                                className={`bg-white rounded-xl border border-zinc-200 p-5 ${(stat as any).span ? "col-span-2 lg:col-span-4" : ""}`}
                            >
                                <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">{stat.label}</p>
                                <p className="text-3xl font-bold text-zinc-900 mt-1">{stat.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Top Events */}
                    {data.topEvents?.length > 0 && (
                        <div className="bg-white rounded-xl border border-zinc-200">
                            <div className="px-5 py-4 border-b border-zinc-100">
                                <h2 className="text-sm font-semibold text-zinc-900">Top Events by Registrations</h2>
                            </div>
                            <div className="divide-y divide-zinc-100">
                                {data.topEvents.map((event: any, i: number) => {
                                    const fill = event.capacity > 0
                                        ? Math.min(100, Math.round((event.registrationCount / event.capacity) * 100))
                                        : 0;
                                    return (
                                        <div key={event._id} className="flex items-center gap-4 px-5 py-4">
                                            <span className="text-sm font-bold text-zinc-300 w-5 shrink-0">#{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-zinc-900 truncate">{event.title}</p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-orange-400 rounded-full"
                                                            style={{ width: `${fill || Math.min(100, (event.registrationCount / (data.topEvents[0].registrationCount || 1)) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-zinc-400 shrink-0">
                                                        {event.registrationCount}{event.capacity > 0 ? ` / ${event.capacity}` : " registrations"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Pending / Unconfirmed Registrations */}
                    {data.pendingRegistrations?.length > 0 && (
                        <div className="bg-white rounded-xl border border-yellow-200">
                            <div className="px-5 py-4 border-b border-yellow-100 flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-zinc-900">
                                    Unconfirmed Registrations
                                </h2>
                                <span className="text-xs font-medium bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">
                                    {data.pendingRegistrations.length}
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-zinc-100 bg-zinc-50/50">
                                            <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Participant</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Event</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Payment</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Transaction ID</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Registered</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                        {data.pendingRegistrations.map((reg: any) => (
                                            <tr key={reg._id} className="hover:bg-zinc-50 transition-colors">
                                                <td className="px-5 py-3.5">
                                                    <p className="font-medium text-zinc-900">{reg.userId?.name ?? "—"}</p>
                                                    <p className="text-xs text-zinc-400">{reg.userId?.email ?? "—"}</p>
                                                </td>
                                                <td className="px-4 py-3.5 text-zinc-600 truncate max-w-40">
                                                    {reg.eventId?._id ? (
                                                        <a
                                                            href={`/manage/events/${reg.eventId._id}`}
                                                            className="hover:text-orange-600 hover:underline"
                                                        >
                                                            {reg.eventId.title}
                                                        </a>
                                                    ) : "—"}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                        reg.status === "pending" ? "bg-yellow-50 text-yellow-700"
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
                                                <td className="px-4 py-3.5 text-xs text-zinc-500 font-mono">
                                                    {reg.paymentId ?? "—"}
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
                        </div>
                    )}

                    {/* Recent Registrations */}
                    {data.recentRegistrations?.length > 0 && (
                        <div className="bg-white rounded-xl border border-zinc-200">
                            <div className="px-5 py-4 border-b border-zinc-100">
                                <h2 className="text-sm font-semibold text-zinc-900">Recent Confirmed Registrations</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-zinc-100 bg-zinc-50/50">
                                            <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Participant</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Event</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Transaction ID</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Registered</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                        {data.recentRegistrations.map((reg: any) => (
                                            <tr key={reg._id} className="hover:bg-zinc-50 transition-colors">
                                                <td className="px-5 py-3.5">
                                                    <p className="font-medium text-zinc-900">{reg.userId?.name ?? "—"}</p>
                                                    <p className="text-xs text-zinc-400">{reg.userId?.email ?? "—"}</p>
                                                </td>
                                                <td className="px-4 py-3.5 text-zinc-600 truncate max-w-40">
                                                    {reg.eventId?.title ?? "—"}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${reg.status === "confirmed" ? "bg-green-50 text-green-700"
                                                            : reg.status === "pending" ? "bg-yellow-50 text-yellow-700"
                                                                : "bg-red-50 text-red-600"
                                                        }`}>{reg.status}</span>
                                                </td>
                                                <td className="px-4 py-3.5 text-xs text-zinc-500 font-mono">
                                                    {reg.paymentId ?? "—"}
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
                        </div>
                    )}
                </>
            )}
        </div>
    );
}