// app/dashboard/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useMyTickets, useMyRegistrations } from "@/hooks/use-tickets";
import {
  IconTicket, IconCalendarEvent, IconMapPin, IconQrcode,
  IconX, IconUser, IconLogout, IconArrowUpRight,
} from "@tabler/icons-react";
import type { ITicket, IRegistration } from "@/types";

// ─── QR Modal ─────────────────────────────────────────────────────────────────

function QRModal({ ticket, onClose }: { ticket: ITicket; onClose: () => void }) {
  const event = ticket.eventId as any;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/verify/${ticket.qrCode}`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-xs text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-900">Your Ticket</h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700">
            <IconX size={18} />
          </button>
        </div>

        <img
          src={qrUrl}
          alt="QR Code"
          className="w-52 h-52 mx-auto p-2.5 rounded-xl border border-zinc-100"
        />

        <div className="mt-4 space-y-1">
          <p className="text-sm font-semibold text-zinc-900">{event?.title ?? "Event"}</p>
          <p className="text-xs text-zinc-400">
            {event?.date?.start
              ? new Date(event.date.start).toLocaleDateString("en-IN", {
                day: "numeric", month: "long", year: "numeric",
              })
              : ""}
          </p>
          {event?.venue && <p className="text-xs text-zinc-400">{event.venue}</p>}
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-zinc-400">
          <span className={`w-2 h-2 rounded-full ${ticket.attendanceStatus ? "bg-green-400" : "bg-zinc-300"}`} />
          {ticket.attendanceStatus ? "Checked in" : "Not checked in yet"}
        </div>

        <p className="text-xs text-zinc-300 mt-3 font-mono break-all">{ticket.qrCode}</p>
      </div>
    </div>
  );
}

// ─── Ticket Card ──────────────────────────────────────────────────────────────

function TicketCard({ ticket, onQR }: { ticket: ITicket; onQR: () => void }) {
  const event = ticket.eventId as any;
  const isPast = event?.date?.end ? new Date(event.date.end) < new Date() : false;
  const isCancelled = event?.status === "cancelled";

  return (
    <div
      className={`bg-white rounded-2xl border overflow-hidden transition-all ${
        isCancelled
          ? "border-red-200 bg-red-50/60"
          : "hover:shadow-md border-zinc-200"
      } ${isPast && !isCancelled ? "opacity-70" : ""}`}
    >
      <div className="relative h-32 bg-zinc-100 overflow-hidden">
        {event?.coverImage ? (
          <img src={event.coverImage} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <IconTicket size={32} className="text-zinc-200" />
          </div>
        )}
        {isPast && !isCancelled && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="text-white text-xs font-bold bg-black/50 px-2.5 py-1 rounded-full">Past Event</span>
          </div>
        )}
        {isCancelled && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-xs font-bold bg-red-500 px-2.5 py-1 rounded-full">Cancelled</span>
          </div>
        )}
        <div className="absolute top-2.5 right-2.5">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ticket.attendanceStatus
              ? "bg-green-500 text-white"
              : "bg-white text-zinc-600 border border-zinc-200"
            }`}>
            {ticket.attendanceStatus ? "Checked In" : "Not checked in"}
          </span>
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-sm font-semibold text-zinc-900 leading-snug line-clamp-2">
          {event?.title ?? "Event"}
        </h3>
        <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400">
          {event?.date?.start && (
            <span className="flex items-center gap-1">
              <IconCalendarEvent size={12} />
              {new Date(event.date.start).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
          {event?.venue && (
            <span className="flex items-center gap-1 truncate">
              <IconMapPin size={12} />
              {event.venue}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-1">
          <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${ticket.teamRole === "leader" ? "bg-blue-50 text-blue-700" :
              ticket.teamRole === "member" ? "bg-purple-50 text-purple-700" :
                "bg-zinc-100 text-zinc-500"
            }`}>
            {ticket.teamRole}
          </span>
        </div>

        <button
          onClick={() => { if (!isCancelled) onQR(); }}
          disabled={isCancelled}
          className={`mt-3 w-full flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-xl transition-colors ${
            isCancelled
              ? "bg-zinc-200 text-zinc-500 cursor-not-allowed"
              : "bg-primary hover:bg-primary/80 text-white"
          }`}
        >
          <IconQrcode size={14} />
          {isCancelled ? "Unavailable (Cancelled)" : "View QR Code"}
        </button>
      </div>
    </div>
  );
}

// ─── Registration Row ──────────────────────────────────────────────────────────

function RegistrationRow({ reg }: { reg: IRegistration }) {
  const event = reg.eventId as any;

  return (
    <div className="flex items-center justify-between px-4 py-3.5 hover:bg-zinc-50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-zinc-100 overflow-hidden shrink-0">
          {event?.coverImage ? (
            <img src={event.coverImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <IconCalendarEvent size={14} className="text-zinc-300" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-900 truncate">{event?.title ?? "—"}</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {event?.date?.start
              ? new Date(event.date.start).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
              : "—"}
            {reg.isTeamRegistration && " · Team registration"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${reg.status === "confirmed" ? "bg-green-50 text-green-700"
            : reg.status === "pending" ? "bg-yellow-50 text-yellow-700"
              : "bg-red-50 text-red-600"
          }`}>
          {reg.status}
        </span>
        {event?.status === "cancelled" && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">
            Cancelled
          </span>
        )}
        {event?.slug && (
          <Link href={`/events/${event.slug}`} className="p-1 text-zinc-400 hover:text-zinc-700">
            <IconArrowUpRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session } = useSession();
  const { tickets, loading: ticketsLoading } = useMyTickets();
  const { registrations, loading: regsLoading } = useMyRegistrations();
  const [ticketTab, setTicketTab] = useState<"upcoming" | "past">("upcoming");
  const [activeQR, setActiveQR] = useState<ITicket | null>(null);

  const now = new Date();

  const upcomingTickets = tickets.filter((t) => {
    const event = t.eventId as any;
    return event?.date?.end ? new Date(event.date.end) >= now : true;
  });

  const pastTickets = tickets.filter((t) => {
    const event = t.eventId as any;
    return event?.date?.end ? new Date(event.date.end) < now : false;
  });

  const displayedTickets = ticketTab === "upcoming" ? upcomingTickets : pastTickets;

  return (
    <div className="min-h-screen bg-zinc-50">
      {activeQR && (
        <QRModal ticket={activeQR} onClose={() => setActiveQR(null)} />
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            Hey, {session?.user?.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">Your registrations and tickets.</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Tickets", value: tickets.length },
            { label: "Upcoming", value: upcomingTickets.length },
            { label: "Registrations", value: registrations.length },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-zinc-200 p-4 text-center">
              <p className="text-2xl font-bold text-zinc-900">{s.value}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tickets section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-zinc-900">My Tickets</h2>
            <div className="flex bg-zinc-100 rounded-lg p-0.5 gap-0.5">
              {(["upcoming", "past"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTicketTab(tab)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${ticketTab === tab ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                    }`}
                >
                  {tab} ({tab === "upcoming" ? upcomingTickets.length : pastTickets.length})
                </button>
              ))}
            </div>
          </div>

          {ticketsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden animate-pulse">
                  <div className="h-32 bg-zinc-100" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-zinc-100 rounded w-3/4" />
                    <div className="h-3 bg-zinc-100 rounded w-1/2" />
                    <div className="h-8 bg-zinc-100 rounded-xl mt-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayedTickets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 py-16 text-center">
              <IconTicket size={40} className="mx-auto text-zinc-200 mb-3" />
              <p className="text-sm text-zinc-500 font-medium">
                {ticketTab === "upcoming" ? "No upcoming tickets" : "No past tickets"}
              </p>
              {ticketTab === "upcoming" && (
                <Link
                  href="/events"
                  className="mt-3 inline-block text-sm text-orange-600 font-medium hover:underline"
                >
                  Browse events →
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedTickets.map((ticket) => (
                <TicketCard
                  key={ticket._id.toString()}
                  ticket={ticket}
                  onQR={() => setActiveQR(ticket)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Registrations section */}
        <div>
          <h2 className="text-base font-semibold text-zinc-900 mb-4">My Registrations</h2>
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
            {regsLoading ? (
              <div className="divide-y divide-zinc-100">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-4 animate-pulse">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-zinc-100 rounded w-48" />
                      <div className="h-3 bg-zinc-100 rounded w-32" />
                    </div>
                    <div className="h-5 w-16 bg-zinc-100 rounded-full" />
                  </div>
                ))}
              </div>
            ) : registrations.length === 0 ? (
              <div className="py-14 text-center">
                <IconCalendarEvent size={36} className="mx-auto text-zinc-200 mb-3" />
                <p className="text-sm text-zinc-400">No registrations yet.</p>
                <Link href="/events" className="mt-2 inline-block text-sm text-orange-600 font-medium hover:underline">
                  Browse events →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {registrations.map((reg) => (
                  <RegistrationRow key={reg._id.toString()} reg={reg} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Account section */}
        <div>
          <h2 className="text-base font-semibold text-zinc-900 mb-4">Account</h2>
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-lg font-bold shrink-0">
                {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <p className="font-semibold text-zinc-900">{session?.user?.name}</p>
                <p className="text-sm text-zinc-400">{session?.user?.email}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
              <Link
                href="/account"
                className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                <IconUser size={15} />
                Edit Profile
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                <IconLogout size={15} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}