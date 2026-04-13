"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
    IconTicket, IconLoader2, IconCircleCheck, IconCircleX,
    IconAlertTriangle, IconSearch, IconUser, IconCalendarEvent,
    IconMapPin, IconId, IconPlus, IconX,
    IconChevronDown, IconDownload, IconBan,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { getManageEvents } from "@/actions/events";
import type { IEvent, IFormField } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TicketPreview {
    ticketId: string;
    qrCode: string;
    teamRole: "leader" | "member" | "solo";
    attendanceStatus: boolean;
    recipientName: string | null;
    recipientEmail: string | null;
}

interface RegistrationPreview {
    registrationId: string;
    paymentId: string | null;
    status: string;
    paymentStatus: string;
    createdAt: string;
    event: { title: string; date: string; venue: string | null; price: number };
    registrant: { name: string | null; email: string | null; collegeId: string | null };
    tickets: TicketPreview[];
}

interface SendResult { email: string; status: "sent" | "failed"; error?: string }

interface FoundUser { _id: string; name: string; email: string; collegeId?: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(s: string) {
    if (s === "confirmed" || s === "completed") return "bg-green-50 text-green-700";
    if (s === "pending") return "bg-yellow-50 text-yellow-700";
    if (s === "na") return "bg-zinc-100 text-zinc-500";
    return "bg-red-50 text-red-600";
}

// ─── Section: Regenerate Ticket ───────────────────────────────────────────────

function RegenerateSection() {
    const [identifier, setIdentifier] = useState("");
    const [lookupLoading, setLookupLoading] = useState(false);
    const [lookupError, setLookupError] = useState<string | null>(null);
    const [preview, setPreview] = useState<RegistrationPreview | null>(null);
    const [sendLoading, setSendLoading] = useState(false);
    const [sendResults, setSendResults] = useState<SendResult[] | null>(null);

    async function handleLookup(e: React.FormEvent) {
        e.preventDefault();
        if (!identifier.trim()) return;
        setLookupLoading(true);
        setLookupError(null);
        setPreview(null);
        setSendResults(null);
        try {
            const res = await fetch(`/api/admin/regenerate-ticket?identifier=${encodeURIComponent(identifier.trim())}`);
            const json = await res.json();
            if (json.success) setPreview(json.data);
            else setLookupError(json.error ?? "Not found.");
        } catch {
            setLookupError("Network error.");
        } finally {
            setLookupLoading(false);
        }
    }

    async function handleSend() {
        if (!preview) return;
        setSendLoading(true);
        setSendResults(null);
        try {
            const res = await fetch("/api/admin/regenerate-ticket", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier: identifier.trim() }),
            });
            const json = await res.json();
            if (json.success) {
                setSendResults(json.data.results);
                toast.success(`Sent ${json.data.emailsSent} of ${json.data.ticketsFound} ticket email(s).`);
            } else {
                toast.error(json.error ?? "Failed to send.");
            }
        } catch {
            toast.error("Network error.");
        } finally {
            setSendLoading(false);
        }
    }

    function reset() { setIdentifier(""); setPreview(null); setLookupError(null); setSendResults(null); }

    return (
        <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
                <IconTicket size={18} className="text-orange-500" />
                <h2 className="text-sm font-semibold text-zinc-900">Regenerate Ticket Email</h2>
            </div>
            <p className="text-xs text-zinc-500">
                Re-sends confirmation email(s) for a registration that already exists.
                Paste the HDFC SmartGateway order ID or MongoDB registration ID.
            </p>

            <form onSubmit={handleLookup} className="flex gap-2">
                <input
                    type="text"
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); setPreview(null); setLookupError(null); setSendResults(null); }}
                    placeholder="vig_f239a2106f_mnvtodrl or ObjectId"
                    className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-lg font-mono placeholder:font-sans placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
                <button
                    type="submit"
                    disabled={lookupLoading || !identifier.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                    {lookupLoading ? <IconLoader2 size={15} className="animate-spin" /> : <IconSearch size={15} />}
                    Look up
                </button>
            </form>

            {lookupError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                    <IconAlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700">{lookupError}</p>
                </div>
            )}

            {preview && !sendResults && (
                <div className="space-y-4 pt-1">
                    <div className="border border-zinc-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Event</p>
                            <p className="text-sm font-semibold text-zinc-900">{preview.event.title}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                                <span className="flex items-center gap-1 text-xs text-zinc-500">
                                    <IconCalendarEvent size={12} /> {preview.event.date}
                                </span>
                                {preview.event.venue && (
                                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                                        <IconMapPin size={12} /> {preview.event.venue}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="px-4 py-3 border-b border-zinc-100">
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Registrant</p>
                            <p className="text-sm text-zinc-700">{preview.registrant.name ?? "—"} · {preview.registrant.email ?? "—"}</p>
                            {preview.registrant.collegeId && (
                                <p className="text-xs text-zinc-400 mt-0.5">{preview.registrant.collegeId}</p>
                            )}
                            <div className="flex gap-2 mt-2">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor(preview.status)}`}>{preview.status}</span>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor(preview.paymentStatus)}`}>payment: {preview.paymentStatus}</span>
                            </div>
                            <p className="text-xs text-zinc-400 font-mono mt-1">{preview.registrationId}</p>
                        </div>
                        <div className="px-4 py-3">
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Tickets ({preview.tickets.length})</p>
                            <div className="space-y-2">
                                {preview.tickets.map((t) => (
                                    <div key={t.ticketId} className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="text-sm text-zinc-700">
                                                {t.recipientName ?? <span className="italic text-zinc-400">No user linked</span>}
                                                {t.recipientEmail && <span className="text-zinc-400"> · {t.recipientEmail}</span>}
                                            </p>
                                            <p className="text-xs text-zinc-400 font-mono">{t.qrCode}</p>
                                        </div>
                                        <div className="flex gap-1.5 shrink-0">
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 capitalize">{t.teamRole}</span>
                                            {t.attendanceStatus && <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600">checked in</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={handleSend}
                            disabled={sendLoading}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {sendLoading
                                ? <><IconLoader2 size={15} className="animate-spin" /> Sending…</>
                                : <><IconTicket size={15} /> Send {preview.tickets.length} Ticket Email{preview.tickets.length !== 1 ? "s" : ""}</>}
                        </button>
                        <a
                            href={`/api/admin/download-ticket?identifier=${encodeURIComponent(identifier.trim())}`}
                            download
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                        >
                            <IconDownload size={15} /> Download Tickets
                        </a>
                        <button onClick={reset} className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">Cancel</button>
                    </div>
                </div>
            )}

            {sendResults && (
                <div className="space-y-2 pt-1">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Results</p>
                    {sendResults.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                            {r.status === "sent"
                                ? <IconCircleCheck size={15} className="text-green-500 shrink-0" />
                                : <IconCircleX size={15} className="text-red-400 shrink-0" />}
                            <span className="text-zinc-700">{r.email}</span>
                            {r.error && <span className="text-xs text-red-400 ml-auto">{r.error}</span>}
                        </div>
                    ))}
                    <button onClick={reset} className="mt-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors">Look up another →</button>
                </div>
            )}
        </div>
    );
}

// ─── Section: Create Manual Ticket ────────────────────────────────────────────

function CreateManualTicketSection() {
    const [events, setEvents] = useState<IEvent[]>([]);
    const [eventsLoading, setEventsLoading] = useState(true);

    // Step state
    const [step, setStep] = useState<"form" | "confirm" | "done">("form");

    // Field values
    const [selectedEventId, setSelectedEventId] = useState("");
    const [userEmail, setUserEmail] = useState("");
    const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
    const [userLookupLoading, setUserLookupLoading] = useState(false);
    const [userLookupError, setUserLookupError] = useState<string | null>(null);
    const [formResponses, setFormResponses] = useState<Record<string, string>>({});
    const [teamMembers, setTeamMembers] = useState<{ name: string; email: string }[]>([]);

    // Submit state
    const [submitLoading, setSubmitLoading] = useState(false);
    const [doneData, setDoneData] = useState<{ registrationId: string; manualPaymentId: string; ticketCount: number } | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        getManageEvents().then((all) => {
            setEvents(all.filter((e: IEvent) => e.status === "published"));
            setEventsLoading(false);
        });
    }, []);

    const selectedEvent = events.find((e) => (e._id as string).toString() === selectedEventId) ?? null;
    const customFields: IFormField[] = selectedEvent?.customForm ?? [];
    const isTeamEvent = (selectedEvent as any)?.isTeamEvent ?? false;
    const teamSize = (selectedEvent as any)?.teamSize;

    async function handleUserLookup() {
        if (!userEmail.trim()) return;
        setUserLookupLoading(true);
        setUserLookupError(null);
        setFoundUser(null);
        try {
            const res = await fetch(`/api/admin/lookup-user?email=${encodeURIComponent(userEmail.trim())}`);
            const json = await res.json();
            if (json.success) setFoundUser(json.data);
            else setUserLookupError(json.error ?? "Not found.");
        } catch {
            setUserLookupError("Network error.");
        } finally {
            setUserLookupLoading(false);
        }
    }

    function addTeamMember() {
        setTeamMembers((prev) => [...prev, { name: "", email: "" }]);
    }

    function updateTeamMember(i: number, field: "name" | "email", value: string) {
        setTeamMembers((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
    }

    function removeTeamMember(i: number) {
        setTeamMembers((prev) => prev.filter((_, idx) => idx !== i));
    }

    function canProceedToConfirm() {
        if (!selectedEventId || !foundUser) return false;
        for (const field of customFields) {
            if (field.isRequired && !formResponses[field._id]?.trim()) return false;
        }
        return true;
    }

    async function handleSubmit() {
        if (!foundUser || !selectedEventId) return;
        setSubmitLoading(true);
        setSubmitError(null);
        try {
            const responses = customFields.map((f) => ({
                fieldId: f._id,
                value: formResponses[f._id] ?? "",
            }));

            const res = await fetch("/api/admin/create-ticket", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    eventId: selectedEventId,
                    userId: foundUser._id,
                    formResponses: responses,
                    teamMembers: teamMembers.filter((m) => m.name && m.email),
                }),
            });
            const json = await res.json();
            if (json.success) {
                setDoneData(json.data);
                setStep("done");
                toast.success("Ticket created and email sent.");
            } else {
                setSubmitError(json.error ?? "Failed.");
                toast.error(json.error ?? "Failed to create ticket.");
            }
        } catch {
            setSubmitError("Network error.");
            toast.error("Network error.");
        } finally {
            setSubmitLoading(false);
        }
    }

    function reset() {
        setStep("form");
        setSelectedEventId("");
        setUserEmail("");
        setFoundUser(null);
        setUserLookupError(null);
        setFormResponses({});
        setTeamMembers([]);
        setDoneData(null);
        setSubmitError(null);
    }

    return (
        <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-5">
            <div className="flex items-center gap-2">
                <IconPlus size={18} className="text-orange-500" />
                <h2 className="text-sm font-semibold text-zinc-900">Create Manual Ticket</h2>
            </div>
            <p className="text-xs text-zinc-500">
                For cases where payment was received but not recorded. Creates a confirmed registration and sends the ticket email — no payment required.
            </p>

            {/* Done state */}
            {step === "done" && doneData && (
                <div className="space-y-3">
                    <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-100 rounded-lg">
                        <IconCircleCheck size={20} className="text-green-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-green-800">Ticket created successfully</p>
                            <p className="text-xs text-green-700 mt-1">
                                {doneData.ticketCount} ticket email{doneData.ticketCount !== 1 ? "s" : ""} sent to {selectedEvent?.title ?? "the event"}.
                            </p>
                            <p className="text-xs text-green-600 font-mono mt-1">{doneData.registrationId}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <a
                            href={`/api/admin/download-ticket?identifier=${encodeURIComponent(doneData.registrationId)}`}
                            download
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                        >
                            <IconDownload size={15} /> Download Tickets
                        </a>
                        <button onClick={reset} className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">Create another →</button>
                    </div>
                </div>
            )}

            {/* Confirm step */}
            {step === "confirm" && selectedEvent && foundUser && (
                <div className="space-y-4">
                    <div className="border border-zinc-200 rounded-lg overflow-hidden text-sm">
                        <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Event</p>
                            <p className="font-semibold text-zinc-900">{selectedEvent.title}</p>
                        </div>
                        <div className="px-4 py-3 border-b border-zinc-100">
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Registrant</p>
                            <p className="text-zinc-700">{foundUser.name} · {foundUser.email}</p>
                            {foundUser.collegeId && <p className="text-xs text-zinc-400">{foundUser.collegeId}</p>}
                        </div>
                        {customFields.length > 0 && (
                            <div className="px-4 py-3 border-b border-zinc-100">
                                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Form Responses</p>
                                <div className="space-y-1">
                                    {customFields.map((f) => (
                                        <div key={f._id} className="flex gap-2">
                                            <span className="text-zinc-400 shrink-0">{f.label}:</span>
                                            <span className="text-zinc-700">{formResponses[f._id] || <span className="italic text-zinc-300">—</span>}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {teamMembers.filter((m) => m.name && m.email).length > 0 && (
                            <div className="px-4 py-3">
                                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Team Members</p>
                                <div className="space-y-1">
                                    {teamMembers.filter((m) => m.name && m.email).map((m, i) => (
                                        <p key={i} className="text-zinc-700">{m.name} · {m.email}</p>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {submitError && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                            <IconAlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-red-700">{submitError}</p>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSubmit}
                            disabled={submitLoading}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitLoading
                                ? <><IconLoader2 size={15} className="animate-spin" /> Creating…</>
                                : <><IconTicket size={15} /> Confirm & Create Ticket</>}
                        </button>
                        <button
                            onClick={() => setStep("form")}
                            className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
                        >
                            Back
                        </button>
                    </div>
                </div>
            )}

            {/* Form step */}
            {step === "form" && (
                <div className="space-y-5">
                    {/* Event selection */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Event</label>
                        {eventsLoading ? (
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                                <IconLoader2 size={13} className="animate-spin" /> Loading events…
                            </div>
                        ) : (
                            <div className="relative">
                                <select
                                    value={selectedEventId}
                                    onChange={(e) => { setSelectedEventId(e.target.value); setFormResponses({}); }}
                                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent pr-8"
                                >
                                    <option value="">Select an event…</option>
                                    {events.map((e) => (
                                        <option key={(e._id as string).toString()} value={(e._id as string).toString()}>
                                            {e.title} {e.price > 0 ? `(₹${e.price})` : "(Free)"}
                                        </option>
                                    ))}
                                </select>
                                <IconChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                            </div>
                        )}
                    </div>

                    {/* User lookup */}
                    {selectedEventId && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Registrant Email</label>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    value={userEmail}
                                    onChange={(e) => { setUserEmail(e.target.value); setFoundUser(null); setUserLookupError(null); }}
                                    placeholder="student@example.com"
                                    className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                                    onKeyDown={(e) => e.key === "Enter" && handleUserLookup()}
                                />
                                <button
                                    type="button"
                                    onClick={handleUserLookup}
                                    disabled={userLookupLoading || !userEmail.trim()}
                                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                >
                                    {userLookupLoading ? <IconLoader2 size={14} className="animate-spin" /> : <IconSearch size={14} />}
                                    Find
                                </button>
                            </div>

                            {userLookupError && (
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                    <IconAlertTriangle size={12} /> {userLookupError}
                                </p>
                            )}

                            {foundUser && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-lg">
                                    <IconUser size={14} className="text-green-600 shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-green-800">{foundUser.name}</p>
                                        {foundUser.collegeId && (
                                            <p className="text-xs text-green-600 flex items-center gap-1">
                                                <IconId size={11} /> {foundUser.collegeId}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Custom form fields */}
                    {foundUser && customFields.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Registration Form</p>
                            {customFields
                                .slice()
                                .sort((a, b) => a.order - b.order)
                                .map((field) => (
                                    <div key={field._id} className="space-y-1">
                                        <label className="text-xs font-medium text-zinc-700">
                                            {field.label}
                                            {field.isRequired && <span className="text-red-500 ml-0.5">*</span>}
                                        </label>
                                        {field.type === "long_text" ? (
                                            <textarea
                                                rows={3}
                                                value={formResponses[field._id] ?? ""}
                                                onChange={(e) => setFormResponses((prev) => ({ ...prev, [field._id]: e.target.value }))}
                                                placeholder={field.placeholder ?? ""}
                                                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
                                            />
                                        ) : field.type === "dropdown" ? (
                                            <div className="relative">
                                                <select
                                                    value={formResponses[field._id] ?? ""}
                                                    onChange={(e) => setFormResponses((prev) => ({ ...prev, [field._id]: e.target.value }))}
                                                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent pr-8"
                                                >
                                                    <option value="">Select…</option>
                                                    {field.options?.map((opt) => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                                <IconChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                                            </div>
                                        ) : (
                                            <input
                                                type="text"
                                                value={formResponses[field._id] ?? ""}
                                                onChange={(e) => setFormResponses((prev) => ({ ...prev, [field._id]: e.target.value }))}
                                                placeholder={field.placeholder ?? ""}
                                                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                                            />
                                        )}
                                    </div>
                                ))}
                        </div>
                    )}

                    {/* Team members */}
                    {foundUser && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                                    Team Members
                                    {teamSize && <span className="ml-1 font-normal text-zinc-400 normal-case">(up to {teamSize.max - 1} additional)</span>}
                                    {!isTeamEvent && <span className="ml-1 font-normal text-zinc-400 normal-case">(optional)</span>}
                                </p>
                                <button
                                    type="button"
                                    onClick={addTeamMember}
                                    className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium"
                                >
                                    <IconPlus size={12} /> Add member
                                </button>
                            </div>
                            {teamMembers.length === 0 && (
                                <p className="text-xs text-zinc-400 italic">No team members added — ticket will be solo.</p>
                            )}
                            {teamMembers.map((m, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={m.name}
                                        onChange={(e) => updateTeamMember(i, "name", e.target.value)}
                                        placeholder="Name"
                                        className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                                    />
                                    <input
                                        type="email"
                                        value={m.email}
                                        onChange={(e) => updateTeamMember(i, "email", e.target.value)}
                                        placeholder="Email"
                                        className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                                    />
                                    <button type="button" onClick={() => removeTeamMember(i)} className="text-zinc-400 hover:text-red-500 transition-colors">
                                        <IconX size={15} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Proceed button */}
                    {foundUser && (
                        <button
                            type="button"
                            onClick={() => setStep("confirm")}
                            disabled={!canProceedToConfirm()}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Review & Confirm →
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Section: Cancel Ticket ───────────────────────────────────────────────────

function CancelTicketSection() {
    const [ticketId, setTicketId] = useState("");
    const [lookupLoading, setLookupLoading] = useState(false);
    const [lookupError, setLookupError] = useState<string | null>(null);
    const [preview, setPreview] = useState<{
        ticketId: string;
        qrCode: string;
        teamRole: string;
        attendanceStatus: boolean;
        recipientName: string | null;
        recipientEmail: string | null;
        registration: {
            registrationId: string;
            paymentId: string | null;
            status: string;
            paymentStatus: string;
            event: { title: string };
            registrant: { name: string | null; email: string | null; collegeId: string | null };
            ticketCount: number;
        };
    } | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [cancelled, setCancelled] = useState(false);

    async function handleLookup(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!ticketId.trim()) return;
        setLookupLoading(true);
        setLookupError(null);
        setPreview(null);
        setConfirmOpen(false);
        setCancelled(false);
        try {
            const res = await fetch(`/api/admin/cancel-ticket?ticketId=${encodeURIComponent(ticketId.trim())}`);
            const json = await res.json();
            if (json.success) setPreview(json.data);
            else setLookupError(json.error ?? "Not found.");
        } catch {
            setLookupError("Network error.");
        } finally {
            setLookupLoading(false);
        }
    }

    async function handleCancel() {
        if (!preview) return;
        setCancelLoading(true);
        try {
            const res = await fetch("/api/admin/cancel-ticket", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticketId: ticketId.trim() }),
            });
            const json = await res.json();
            if (json.success) {
                setCancelled(true);
                setConfirmOpen(false);
                toast.success("Registration cancelled successfully.");
            } else {
                toast.error(json.error ?? "Failed to cancel.");
            }
        } catch {
            toast.error("Network error.");
        } finally {
            setCancelLoading(false);
        }
    }

    function reset() {
        setTicketId("");
        setPreview(null);
        setLookupError(null);
        setConfirmOpen(false);
        setCancelled(false);
    }

    return (
        <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
                <IconBan size={18} className="text-red-500" />
                <h2 className="text-sm font-semibold text-zinc-900">Cancel Ticket</h2>
            </div>
            <p className="text-xs text-zinc-500">
                Cancel a registration by ticket ID (QR code string or ObjectId). This sets the registration status to&nbsp;
                <span className="font-mono">cancelled</span> and decrements the event&apos;s registration count.
            </p>

            <form onSubmit={handleLookup} className="flex gap-2">
                <input
                    type="text"
                    value={ticketId}
                    onChange={(e) => { setTicketId(e.target.value); setPreview(null); setLookupError(null); setCancelled(false); setConfirmOpen(false); }}
                    placeholder="vig_f239a2106f_mnvtodrl or ObjectId"
                    className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-lg font-mono placeholder:font-sans placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                />
                <button
                    type="submit"
                    disabled={lookupLoading || !ticketId.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                    {lookupLoading ? <IconLoader2 size={15} className="animate-spin" /> : <IconSearch size={15} />}
                    Look up
                </button>
            </form>

            {lookupError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                    <IconAlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700">{lookupError}</p>
                </div>
            )}

            {cancelled && (
                <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-100 rounded-lg">
                    <IconCircleCheck size={15} className="text-green-600 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-green-800">Registration cancelled.</p>
                        <button onClick={reset} className="mt-1 text-xs text-green-600 hover:text-green-800 transition-colors">Cancel another →</button>
                    </div>
                </div>
            )}

            {preview && !cancelled && (
                <div className="space-y-4 pt-1">
                    <div className="border border-zinc-200 rounded-lg overflow-hidden text-sm">
                        <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Event</p>
                            <p className="font-semibold text-zinc-900">{preview.registration.event.title}</p>
                        </div>
                        <div className="px-4 py-3 border-b border-zinc-100">
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Registrant</p>
                            <p className="text-zinc-700">{preview.registration.registrant.name ?? "—"} · {preview.registration.registrant.email ?? "—"}</p>
                            {preview.registration.registrant.collegeId && (
                                <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1"><IconId size={11} />{preview.registration.registrant.collegeId}</p>
                            )}
                            <div className="flex gap-2 mt-2 flex-wrap">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor(preview.registration.status)}`}>{preview.registration.status}</span>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor(preview.registration.paymentStatus)}`}>payment: {preview.registration.paymentStatus}</span>
                            </div>
                            <p className="text-xs text-zinc-400 font-mono mt-1">{preview.registration.registrationId}</p>
                        </div>
                        <div className="px-4 py-3">
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Ticket</p>
                            <p className="text-zinc-700">
                                {preview.recipientName ?? <span className="italic text-zinc-400">No user linked</span>}
                                {preview.recipientEmail && <span className="text-zinc-400"> · {preview.recipientEmail}</span>}
                            </p>
                            <p className="text-xs text-zinc-400 font-mono mt-0.5">{preview.qrCode}</p>
                            <div className="flex gap-1.5 mt-1.5">
                                <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 capitalize">{preview.teamRole}</span>
                                {preview.attendanceStatus && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">already checked in</span>}
                                <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">{preview.registration.ticketCount} ticket{preview.registration.ticketCount !== 1 ? "s" : ""} in registration</span>
                            </div>
                        </div>
                    </div>

                    {preview.registration.status === "cancelled" ? (
                        <div className="flex items-start gap-2 p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                            <IconAlertTriangle size={15} className="text-zinc-400 mt-0.5 shrink-0" />
                            <p className="text-sm text-zinc-500">This registration is already cancelled.</p>
                        </div>
                    ) : confirmOpen ? (
                        <div className="space-y-3">
                            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <IconAlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
                                <p className="text-sm text-red-700">
                                    This will cancel the entire registration ({preview.registration.ticketCount} ticket{preview.registration.ticketCount !== 1 ? "s" : ""}).
                                    This action cannot be undone from the UI.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCancel}
                                    disabled={cancelLoading}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {cancelLoading
                                        ? <><IconLoader2 size={15} className="animate-spin" /> Cancelling…</>
                                        : <><IconBan size={15} /> Yes, Cancel Registration</>}
                                </button>
                                <button
                                    onClick={() => setConfirmOpen(false)}
                                    className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
                                >
                                    Go back
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setConfirmOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                            >
                                <IconBan size={15} /> Cancel Registration
                            </button>
                            <button onClick={reset} className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">Clear</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ToolsPage() {
    const { data: session, status } = useSession();

    if (status === "loading") {
        return (
            <div className="flex items-center justify-center h-40">
                <IconLoader2 size={20} className="animate-spin text-zinc-400" />
            </div>
        );
    }

    if (session?.user?.role !== "super_admin") {
        return (
            <div className="text-center py-20">
                <p className="text-zinc-400 text-sm">You don&apos;t have permission to view this page.</p>
            </div>
        );
    }

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <div>
                <h1 className="text-xl font-bold text-zinc-900">Admin Tools</h1>
                <p className="text-sm text-zinc-500 mt-1">Super admin utilities for manual operations.</p>
            </div>
            <CreateManualTicketSection />
            <RegenerateSection />
            <CancelTicketSection />
        </div>
    );
}
