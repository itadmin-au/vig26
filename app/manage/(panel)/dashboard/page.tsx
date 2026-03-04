// app/manage/(panel)/dashboard/page.tsx
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getAnalytics } from "@/actions/admin";
import { getManageEvents } from "@/actions/events";
import Link from "next/link";
import { IconCalendarEvent, IconUsers, IconChartBar, IconArrowUpRight } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";

export default async function ManageDashboardPage() {
    const session = await getServerSession(authOptions);
    const isSuperAdmin = session?.user?.role === "super_admin";

    const [events] = await Promise.all([
        getManageEvents(),
    ]);

    const analytics = isSuperAdmin ? await getAnalytics() : null;
    const analyticsData = analytics?.success ? analytics.data : null;

    const published = events.filter((e) => e.status === "published").length;
    const drafts = events.filter((e) => e.status === "draft").length;
    const recentEvents = events.slice(0, 5);

    const stats = [
        {
            label: "Total Events",
            value: events.length,
            sub: `${published} published · ${drafts} draft`,
            icon: <IconCalendarEvent size={20} className="text-orange-500" />,
            href: "/manage/events",
        },
        {
            label: "Registrations",
            value: analyticsData?.totalRegistrations ?? "—",
            sub: analyticsData ? `${analyticsData.confirmedRegistrations} confirmed` : "Super admin only",
            icon: <IconUsers size={20} className="text-orange-500" />,
            href: "/manage/analytics",
        },
        {
            label: "Published Events",
            value: published,
            sub: "Live and accepting registrations",
            icon: <IconChartBar size={20} className="text-orange-500" />,
            href: "/manage/events",
        },
        {
            label: "Revenue",
            value: analyticsData ? `₹${analyticsData.totalRevenue.toLocaleString()}` : "—",
            sub: analyticsData ? "From paid registrations" : "Super admin only",
            icon: <IconChartBar size={20} className="text-orange-500" />,
            href: "/manage/analytics",
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900">
                    Welcome back, {session?.user?.name?.split(" ")[0]}
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                    Here&apos;s what&apos;s happening with Vigyanrang.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => (
                    <Link
                        key={stat.label}
                        href={stat.href}
                        className="bg-white rounded-xl border border-zinc-200 p-5 hover:border-zinc-300 hover:shadow-sm transition-all group"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
                                {stat.icon}
                            </div>
                            <IconArrowUpRight size={16} className="text-zinc-300 group-hover:text-zinc-400 transition-colors" />
                        </div>
                        <p className="text-2xl font-bold text-zinc-900">{stat.value}</p>
                        <p className="text-sm text-zinc-500 mt-0.5">{stat.label}</p>
                        <p className="text-xs text-zinc-400 mt-1">{stat.sub}</p>
                    </Link>
                ))}
            </div>

            {/* Recent Events */}
            <div className="bg-white rounded-xl border border-zinc-200">
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                    <h2 className="text-sm font-semibold text-zinc-900">Recent Events</h2>
                    <Link href="/manage/events" className="text-xs text-orange-600 hover:underline font-medium">
                        View all
                    </Link>
                </div>
                {recentEvents.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                        <p className="text-sm text-zinc-400">No events yet.</p>
                        <Link
                            href="/manage/events/new"
                            className="mt-3 inline-block text-sm text-orange-600 font-medium hover:underline"
                        >
                            Create your first event →
                        </Link>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-100">
                        {recentEvents.map((event) => (
                            <Link
                                key={event._id.toString()}
                                href={`/manage/events/${event._id}`}
                                className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-2 h-2 rounded-full shrink-0 bg-orange-400" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-zinc-900 truncate">{event.title}</p>
                                        <p className="text-xs text-zinc-400">
                                            {new Date(event.date.start).toLocaleDateString("en-IN", {
                                                day: "numeric", month: "short", year: "numeric",
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${event.status === "published"
                                        ? "bg-green-50 text-green-700"
                                        : event.status === "draft"
                                            ? "bg-zinc-100 text-zinc-600"
                                            : "bg-red-50 text-red-600"
                                    }`}>
                                    {event.status}
                                </span>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Super admin: recent registrations */}
            {analyticsData?.recentRegistrations && analyticsData.recentRegistrations.length > 0 && (
                <div className="bg-white rounded-xl border border-zinc-200">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                        <h2 className="text-sm font-semibold text-zinc-900">Recent Registrations</h2>
                        <Link href="/manage/analytics" className="text-xs text-orange-600 hover:underline font-medium">
                            View analytics
                        </Link>
                    </div>
                    <div className="divide-y divide-zinc-100">
                        {analyticsData.recentRegistrations.slice(0, 5).map((reg: any) => (
                            <div key={reg._id} className="flex items-center justify-between px-5 py-3.5">
                                <div>
                                    <p className="text-sm font-medium text-zinc-900">
                                        {reg.userId?.name ?? "Unknown"}
                                    </p>
                                    <p className="text-xs text-zinc-400">
                                        {reg.eventId?.title ?? "Unknown event"}
                                    </p>
                                </div>
                                <span className="text-xs text-zinc-400">
                                    {formatDistanceToNow(new Date(reg.createdAt), { addSuffix: true })}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}