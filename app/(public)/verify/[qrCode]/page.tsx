// app/(public)/verify/[qrCode]/page.tsx
import { verifyTicketQR } from "@/actions/registrations";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
    IconCircleCheck,
    IconCircleX,
    IconCalendarEvent,
    IconMapPin,
    IconUser,
    IconTicket,
    IconClockHour4,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
    title: "Verify Ticket · Vigyanrang",
    robots: { index: false },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
    });
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
    });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
    params: { qrCode: string };
}

export default async function VerifyTicketPage({ params }: PageProps) {
    const { qrCode } = params;

    if (!qrCode || !/^[a-f0-9-]{8,}$/i.test(qrCode)) {
        notFound();
    }

    const result = await verifyTicketQR(qrCode);

    // Invalid QR — show error state (not 404, so volunteers see a clear message)
    if (!result.success || !result.data) {
        return (
            <VerifyLayout>
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                        <IconCircleX size={40} className="text-red-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-zinc-900">Invalid Ticket</h1>
                        <p className="text-sm text-zinc-500 mt-1">
                            This QR code does not match any ticket in our system.
                        </p>
                    </div>
                    <div className="bg-zinc-50 rounded-xl border border-zinc-200 px-4 py-3">
                        <p className="text-xs text-zinc-400 font-mono break-all">{qrCode}</p>
                    </div>
                    <p className="text-xs text-zinc-400">
                        If you think this is a mistake, contact the event coordinator.
                    </p>
                </div>
            </VerifyLayout>
        );
    }

    const ticket = result.data as unknown as {
        _id: string;
        qrCode: string;
        attendanceStatus: boolean;
        teamRole: "leader" | "member" | "solo";
        teamId?: string;
        checkedInAt?: string;
        eventId: {
            _id: string;
            title: string;
            date: { start: string; end: string };
            venue?: string;
        };
        userId: {
            _id: string;
            name: string;
            email: string;
            collegeId?: string;
        };
    };

    const event = ticket.eventId;
    const user = ticket.userId;
    const checkedIn = ticket.attendanceStatus;

    return (
        <VerifyLayout>
            <div className="space-y-5">
                {/* Status */}
                <div className={cn(
                    "rounded-2xl border p-5 flex items-center gap-4",
                    checkedIn
                        ? "border-green-200 bg-green-50"
                        : "border-orange-200 bg-orange-50"
                )}>
                    <div className={cn(
                        "w-14 h-14 rounded-full flex items-center justify-center shrink-0",
                        checkedIn ? "bg-green-100" : "bg-orange-100"
                    )}>
                        {checkedIn
                            ? <IconCircleCheck size={32} className="text-green-500" />
                            : <IconTicket size={32} className="text-orange-500" />
                        }
                    </div>
                    <div>
                        <p className={cn(
                            "text-base font-bold",
                            checkedIn ? "text-green-800" : "text-orange-800"
                        )}>
                            {checkedIn ? "Attended" : "Valid Ticket"}
                        </p>
                        <p className={cn(
                            "text-sm mt-0.5",
                            checkedIn ? "text-green-600" : "text-orange-600"
                        )}>
                            {checkedIn
                                ? ticket.checkedInAt
                                    ? `Checked in at ${formatTime(ticket.checkedInAt)}`
                                    : "Attendance marked"
                                : "Not yet checked in"
                            }
                        </p>
                    </div>
                </div>

                {/* Participant */}
                <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
                    <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Participant
                    </h2>

                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-orange-100 flex items-center justify-center shrink-0 text-base font-bold text-orange-600">
                            {user.name[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-zinc-900">{user.name}</p>
                            <p className="text-sm text-zinc-500 truncate">{user.email}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {user.collegeId && (
                            <div className="bg-zinc-50 rounded-xl p-3">
                                <p className="text-xs text-zinc-400 mb-1">College ID</p>
                                <p className="text-sm font-mono font-medium text-zinc-800">
                                    {user.collegeId}
                                </p>
                            </div>
                        )}
                        <div className="bg-zinc-50 rounded-xl p-3">
                            <p className="text-xs text-zinc-400 mb-1">Role</p>
                            <span className={cn(
                                "text-xs font-medium px-2 py-0.5 rounded-full capitalize inline-block",
                                ticket.teamRole === "leader" ? "bg-blue-100 text-blue-700"
                                    : ticket.teamRole === "member" ? "bg-purple-100 text-purple-700"
                                        : "bg-zinc-200 text-zinc-600"
                            )}>
                                {ticket.teamRole}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Event */}
                <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-3">
                    <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Event
                    </h2>

                    <p className="text-base font-bold text-zinc-900">{event.title}</p>

                    <div className="space-y-2">
                        <div className="flex items-start gap-2 text-sm text-zinc-600">
                            <IconCalendarEvent size={16} className="text-zinc-400 mt-0.5 shrink-0" />
                            <div>
                                <span>{formatDate(event.date.start)}</span>
                                <span className="text-zinc-400 mx-1.5">·</span>
                                <span className="text-zinc-500">
                                    {formatTime(event.date.start)} – {formatTime(event.date.end)}
                                </span>
                            </div>
                        </div>

                        {event.venue && (
                            <div className="flex items-center gap-2 text-sm text-zinc-600">
                                <IconMapPin size={16} className="text-zinc-400 shrink-0" />
                                <span>{event.venue}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Ticket ID */}
                <div className="bg-zinc-50 rounded-xl border border-zinc-200 px-4 py-3">
                    <p className="text-xs text-zinc-400 mb-1">Ticket ID</p>
                    <p className="text-xs font-mono text-zinc-500 break-all">{ticket.qrCode}</p>
                </div>

                {/* Footer */}
                <div className="text-center pt-1">
                    <Link
                        href="/"
                        className="text-xs text-zinc-400 hover:text-orange-500 transition-colors"
                    >
                        Vigyan<span className="text-orange-500">rang</span>
                    </Link>
                </div>
            </div>
        </VerifyLayout>
    );
}

// ─── Shared Layout Wrapper ────────────────────────────────────────────────────

function VerifyLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4 py-10">
            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="text-center mb-6">
                    <span className="text-2xl font-bold text-zinc-900">
                        Vigyan<span className="text-orange-500">rang</span>
                    </span>
                    <p className="text-xs text-zinc-400 mt-1">Ticket Verification</p>
                </div>

                {children}
            </div>
        </div>
    );
}