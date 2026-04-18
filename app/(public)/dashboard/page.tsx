// app/dashboard/page.tsx
"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useMyTickets, useMyRegistrations } from "@/hooks/use-tickets";
import {
  IconTicket, IconCalendarEvent, IconMapPin, IconQrcode,
  IconX, IconUser, IconLogout, IconArrowUpRight, IconUsers,
  IconPencil, IconTrash, IconPlus, IconCheck, IconLoader2,
  IconChevronDown, IconChevronUp, IconAlertCircle, IconCreditCard,
} from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { updateTeamMember, removeTeamMember, addTeamMember } from "@/actions/registrations";
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
  const whatsappLink = event?.whatsappLink as string | undefined;

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
        {whatsappLink && !isCancelled && (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 w-full flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Join WhatsApp Group
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Team Management Panel ────────────────────────────────────────────────────

type EditingMember = { index: number; name: string; email: string; usn: string } | null;

function TeamManagePanel({
  reg,
  onRefresh,
}: {
  reg: IRegistration;
  onRefresh: () => void;
}) {
  const event = reg.eventId as any;
  const members: { name: string; email: string; usn?: string | null; userId?: any }[] = reg.teamMembers as any;
  const maxTotal = event?.teamSize?.max ?? 5;
  const minTotal = event?.teamSize?.min ?? 2;
  const maxTeammates = maxTotal - 1;
  const minTeammates = minTotal - 1;
  const pricePerPerson: boolean = !!event?.pricePerPerson;
  const memberPrice: number = event?.price ?? 0;
  const canAdd = members.length < maxTeammates;

  const [editing, setEditing] = useState<EditingMember>(null);
  const [addForm, setAddForm] = useState<{ name: string; email: string; usn: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [addLookup, setAddLookup] = useState<{ loading: boolean; found: boolean; fetched: boolean }>({ loading: false, found: false, fetched: false });
  const addDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addFormRef = useRef(addForm);
  addFormRef.current = addForm;

  function handleAddEmailChange(email: string) {
    setAddForm((prev) => prev ? { ...prev, email } : null);
    setAddLookup({ loading: false, found: false, fetched: false });
    if (addDebounceRef.current) clearTimeout(addDebounceRef.current);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    setAddLookup({ loading: true, found: false, fetched: false });
    addDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/member-lookup?email=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (data.exists) {
          setAddForm((prev) => prev ? { ...prev, name: data.user.name, usn: data.user.usn || prev.usn } : null);
          setAddLookup({ loading: false, found: true, fetched: true });
        } else {
          setAddLookup({ loading: false, found: false, fetched: true });
        }
      } catch {
        setAddLookup({ loading: false, found: false, fetched: true });
      }
    }, 500);
  }

  async function handleSaveEdit() {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error("Name is required."); return; }
    if (!editing.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.email)) {
      toast.error("Valid email is required."); return;
    }
    setBusy(true);
    const res = await updateTeamMember(reg._id.toString(), editing.index, {
      name: editing.name,
      email: editing.email,
      usn: editing.usn,
    });
    setBusy(false);
    if (res.success) {
      toast.success("Member updated.");
      setEditing(null);
      onRefresh();
    } else {
      toast.error(res.error ?? "Failed to update member.");
    }
  }

  async function handleRemove(index: number) {
    if (!confirm("Remove this member? No refund will be issued.")) return;
    setBusy(true);
    const res = await removeTeamMember(reg._id.toString(), index);
    setBusy(false);
    if (res.success) {
      toast.success("Member removed.");
      onRefresh();
    } else {
      toast.error(res.error ?? "Failed to remove member.");
    }
  }

  async function handleAdd() {
    if (!addForm) return;
    if (!addForm.name.trim()) { toast.error("Name is required."); return; }
    if (!addForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addForm.email)) {
      toast.error("Valid email is required."); return;
    }

    setBusy(true);
    const res = await addTeamMember(reg._id.toString(), { name: addForm.name, email: addForm.email, usn: addForm.usn });
    setBusy(false);

    if ("requiresPayment" in res && res.requiresPayment) {
      // Initiate HDFC payment for per-person event
      setBusy(true);
      try {
        const orderRes = await fetch("/api/payment/add-member-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registrationId: reg._id.toString(),
            memberName: addForm.name,
            memberEmail: addForm.email,
          }),
        });
        const orderJson = await orderRes.json();
        setBusy(false);
        if (!orderJson.success) { toast.error(orderJson.error ?? "Failed to create payment order."); return; }

        sessionStorage.setItem("hdfc_pending", JSON.stringify({
          type: "add_member",
          registrationId: reg._id.toString(),
          memberName: addForm.name,
          memberEmail: addForm.email,
          memberUsn: addForm.usn,
          eventTitle: event?.title ?? "",
        }));
        window.location.href = orderJson.data.paymentLink;
      } catch {
        setBusy(false);
        toast.error("Network error. Please try again.");
      }
      return;
    }

    if (res.success) {
      toast.success("Member added and ticket sent.");
      setAddForm(null);
      onRefresh();
    } else {
      toast.error(res.error ?? "Failed to add member.");
    }
  }

  return (
    <div className="px-4 pb-4 pt-1 bg-zinc-50 border-t border-zinc-100 space-y-3">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide pt-2">
        Team Members ({members.length + 1} / {maxTotal})
      </p>

      {/* Leader row — read-only */}
      <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2.5">
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">You · Leader</span>
      </div>

      {/* Member rows */}
      {members.map((m, i) => (
        <div key={i}>
          {editing?.index === i ? (
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-zinc-600">Editing member {i + 2}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Name</label>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Full name"
                    className="h-9 bg-white text-sm"
                    disabled={busy}
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Email</label>
                  <Input
                    type="email"
                    value={editing.email}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                    placeholder="email@example.com"
                    className="h-9 bg-white text-sm"
                    disabled={busy}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">USN / College ID <span className="text-zinc-400">(optional)</span></label>
                <Input
                  value={editing.usn}
                  onChange={(e) => setEditing({ ...editing, usn: e.target.value })}
                  placeholder="e.g. 1AT21CS045"
                  className="h-9 bg-white text-sm"
                  disabled={busy}
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => setEditing(null)}
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/80 flex items-center gap-1.5"
                >
                  {busy ? <IconLoader2 size={12} className="animate-spin" /> : <IconCheck size={12} />}
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-white border border-zinc-200 rounded-xl px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-800 truncate">{m.name}</p>
                <p className="text-xs text-zinc-400 truncate">{m.email}{m.usn ? ` · ${m.usn}` : ""}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  onClick={() => setEditing({ index: i, name: m.name, email: m.email, usn: m.usn ?? "" })}
                  disabled={busy}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100"
                  title="Edit member"
                >
                  <IconPencil size={14} />
                </button>
                <button
                  onClick={() => handleRemove(i)}
                  disabled={busy || members.length <= minTeammates}
                  className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={members.length <= minTeammates ? `Min team size is ${minTotal}` : "Remove member (no refund)"}
                >
                  <IconTrash size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add member */}
      {canAdd && !addForm && (
        <button
          onClick={() => { setAddForm({ name: "", email: "", usn: "" }); setAddLookup({ loading: false, found: false, fetched: false }); }}
          disabled={busy}
          className="flex items-center gap-2 w-full justify-center py-2.5 border-2 border-dashed border-zinc-200 rounded-xl text-xs text-zinc-500 hover:border-primary/40 hover:text-primary transition-colors"
        >
          <IconPlus size={13} />
          Add member
          {pricePerPerson && memberPrice > 0 && (
            <span className="ml-1 text-zinc-400">(₹{memberPrice} extra)</span>
          )}
        </button>
      )}

      {addForm && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
          <span className="text-xs font-medium text-zinc-600">New member</span>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Name</label>
              <Input
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="Full name"
                className="h-9 bg-white text-sm"
                disabled={busy}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-500">Email</label>
                {addLookup.loading && <span className="text-xs text-zinc-400 flex items-center gap-1"><IconLoader2 size={10} className="animate-spin" /> Looking up…</span>}
                {!addLookup.loading && addLookup.fetched && addLookup.found && <span className="text-xs text-green-600 flex items-center gap-1"><IconCheck size={10} /> Found</span>}
                {!addLookup.loading && addLookup.fetched && !addLookup.found && <span className="text-xs text-zinc-400">Not registered</span>}
              </div>
              <Input
                type="email"
                value={addForm.email}
                onChange={(e) => handleAddEmailChange(e.target.value)}
                placeholder="email@example.com"
                className="h-9 bg-white text-sm"
                disabled={busy}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">USN / College ID <span className="text-zinc-400">(optional)</span></label>
            <Input
              value={addForm.usn}
              onChange={(e) => setAddForm({ ...addForm, usn: e.target.value })}
              placeholder="e.g. 1AT21CS045"
              className="h-9 bg-white text-sm"
              disabled={busy}
            />
          </div>
          {pricePerPerson && memberPrice > 0 && (
            <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
              <IconCreditCard size={13} className="shrink-0 mt-0.5" />
              Adding this member costs ₹{memberPrice}. You'll be redirected to pay.
            </div>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => { setAddForm(null); setAddLookup({ loading: false, found: false, fetched: false }); }}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/80 flex items-center gap-1.5"
            >
              {busy ? <IconLoader2 size={12} className="animate-spin" /> : (pricePerPerson && memberPrice > 0 ? <IconCreditCard size={12} /> : <IconPlus size={12} />)}
              {pricePerPerson && memberPrice > 0 ? `Pay ₹${memberPrice} & Add` : "Add Member"}
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-zinc-400 flex items-center gap-1">
        <IconAlertCircle size={11} />
        Removing a member does not issue a refund.
      </p>
    </div>
  );
}

// ─── Registration Row ──────────────────────────────────────────────────────────

function RegistrationRow({ reg, userId, onRefresh }: { reg: IRegistration; userId: string; onRefresh: () => void }) {
  const event = reg.eventId as any;
  const isLeader = reg.userId.toString() === userId;
  const canManageTeam = isLeader && reg.isTeamRegistration && reg.status === "confirmed";
  const [teamOpen, setTeamOpen] = useState(false);

  return (
    <div>
      <div
        className={`flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-zinc-50 ${canManageTeam ? "cursor-pointer" : ""}`}
        onClick={canManageTeam ? () => setTeamOpen((v) => !v) : undefined}
      >
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
          {canManageTeam && (
            <span className="flex items-center gap-1 text-zinc-400">
              <IconUsers size={13} />
              {teamOpen ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
            </span>
          )}
          {event?.slug && (
            <Link
              href={`/events/${event.slug}`}
              className="p-1 text-zinc-400 hover:text-zinc-700"
              onClick={(e) => e.stopPropagation()}
            >
              <IconArrowUpRight size={14} />
            </Link>
          )}
        </div>
      </div>
      {canManageTeam && teamOpen && (
        <TeamManagePanel reg={reg} onRefresh={onRefresh} />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session } = useSession();
  const { tickets, loading: ticketsLoading } = useMyTickets();
  const { registrations, loading: regsLoading, refetch: refetchRegistrations } = useMyRegistrations();
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
                  <RegistrationRow
                    key={reg._id.toString()}
                    reg={reg}
                    userId={session?.user?.id ?? ""}
                    onRefresh={refetchRegistrations}
                  />
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