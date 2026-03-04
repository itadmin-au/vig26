// app/dashboard/page.tsx
// Temporary static dashboard — replace with real data once APIs are wired up

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ─── Static placeholder data ──────────────────────────────────────────────────

const STATS = [
  { label: "Total Events", value: "24" },
  { label: "Registrations", value: "1,340" },
  { label: "Departments", value: "8" },
  { label: "Students Enrolled", value: "980" },
];

const UPCOMING_EVENTS = [
  {
    id: "1",
    title: "Code Sprint 3.0",
    category: "Hackathon",
    date: "Mar 12, 2026",
    venue: "Seminar Hall A",
    status: "published",
    registrations: 84,
    capacity: 100,
  },
  {
    id: "2",
    title: "Robo Wars",
    category: "Tech",
    date: "Mar 13, 2026",
    venue: "Workshop Block",
    status: "published",
    registrations: 32,
    capacity: 40,
  },
  {
    id: "3",
    title: "Battle of Bands",
    category: "Cultural",
    date: "Mar 14, 2026",
    venue: "Open Air Stage",
    status: "published",
    registrations: 12,
    capacity: 20,
  },
  {
    id: "4",
    title: "UI/UX Design Sprint",
    category: "Workshop",
    date: "Mar 15, 2026",
    venue: "Lab 3",
    status: "draft",
    registrations: 0,
    capacity: 50,
  },
];

const RECENT_REGISTRATIONS = [
  { id: "r1", name: "Arjun Mehta", event: "Code Sprint 3.0", time: "2 mins ago" },
  { id: "r2", name: "Priya Sharma", event: "Battle of Bands", time: "14 mins ago" },
  { id: "r3", name: "Karan Gupta", event: "Robo Wars", time: "1 hr ago" },
  { id: "r4", name: "Sneha Rao", event: "Code Sprint 3.0", time: "2 hrs ago" },
  { id: "r5", name: "Dev Patel", event: "Robo Wars", time: "3 hrs ago" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  return status === "published" ? (
    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
      Published
    </Badge>
  ) : (
    <Badge className="bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-100">
      Draft
    </Badge>
  );
}

function fillPercent(reg: number, cap: number) {
  if (cap === 0) return 0;
  return Math.min(100, Math.round((reg / cap) * 100));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-white border-b border-zinc-200 px-6 py-3 flex items-center justify-between">
        <span className="text-lg font-bold text-zinc-900">
          Vigyanrang <span className="text-orange-500">2026</span>
        </span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">Temporary Dashboard</span>
          <Button asChild size="sm" variant="outline">
            <Link href="/manage/login">Manage →</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Static preview — real data will load once the DB is connected.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <Card key={s.label} className="border-zinc-200 shadow-none">
              <CardContent className="p-5">
                <p className="text-3xl font-bold text-zinc-900">{s.value}</p>
                <p className="text-sm text-zinc-500 mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Upcoming events table */}
          <Card className="md:col-span-2 border-zinc-200 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-zinc-900">
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-zinc-400 text-xs uppercase">
                    <th className="text-left px-5 py-3 font-medium">Event</th>
                    <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Date</th>
                    <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Status</th>
                    <th className="text-right px-5 py-3 font-medium">Fill</th>
                  </tr>
                </thead>
                <tbody>
                  {UPCOMING_EVENTS.map((ev) => {
                    const pct = fillPercent(ev.registrations, ev.capacity);
                    return (
                      <tr
                        key={ev.id}
                        className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors"
                      >
                        <td className="px-5 py-3">
                          <p className="font-medium text-zinc-900">{ev.title}</p>
                          <p className="text-xs text-zinc-400">{ev.category} · {ev.venue}</p>
                        </td>
                        <td className="px-5 py-3 text-zinc-500 hidden sm:table-cell">
                          {ev.date}
                        </td>
                        <td className="px-5 py-3 hidden md:table-cell">
                          {statusBadge(ev.status)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-xs text-zinc-500 block mb-1">
                            {ev.registrations}/{ev.capacity}
                          </span>
                          <div className="w-20 ml-auto h-1.5 rounded-full bg-zinc-100">
                            <div
                              className="h-1.5 rounded-full bg-orange-400"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Recent registrations */}
          <Card className="border-zinc-200 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-zinc-900">
                Recent Registrations
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              <ul className="divide-y divide-zinc-100">
                {RECENT_REGISTRATIONS.map((r) => (
                  <li key={r.id} className="px-5 py-3">
                    <p className="text-sm font-medium text-zinc-900">{r.name}</p>
                    <p className="text-xs text-zinc-400">
                      {r.event} · {r.time}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
