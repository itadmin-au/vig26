// app/events/[slug]/register/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getEventBySlug } from "@/actions/events";
import { createRegistration } from "@/actions/registrations";
// import { Navbar } from "@/components/navbar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    IconArrowLeft, IconArrowRight, IconCheck, IconUsers,
    IconTicket, IconLoader2, IconPlus, IconTrash, IconAlertCircle,
    IconCreditCard, IconRefresh,
} from "@tabler/icons-react";
import type { IEvent, IFormResponse, IEventSlot } from "@/types";
import MDPreview from "@uiw/react-markdown-preview";

// ─── Load Cashfree SDK ─────────────────────────────────────────────────────────

function loadCashfreeScript(): Promise<boolean> {
    return new Promise((resolve) => {
        if (typeof window !== "undefined" && "Cashfree" in window) { resolve(true); return; }
        const script = document.createElement("script");
        script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

// ─── Step indicator ────────────────────────────────────────────────────────────

function Steps({ current, steps }: { current: number; steps: string[] }) {
    return (
        <div className="flex items-center mb-8">
            {steps.map((label, i) => (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                            i < current ? "bg-primary text-primary-foreground"
                                : i === current ? "bg-zinc-900 text-white"
                                : "bg-zinc-100 text-zinc-400"
                        }`}>
                            {i < current ? <IconCheck size={14} /> : i + 1}
                        </div>
                        <span className={`text-xs whitespace-nowrap ${i === current ? "text-zinc-900 font-medium" : "text-zinc-400"}`}>
                            {label}
                        </span>
                    </div>
                    {i < steps.length - 1 && (
                        <div className={`flex-1 h-px mx-2 mb-4 transition-colors ${i < current ? "bg-primary" : "bg-zinc-200"}`} />
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── Step 0 (optional): Slot selection ────────────────────────────────────────

function SlotStep({
    slots, selectedSlotId, onSelect, onNext,
}: {
    slots: IEventSlot[];
    selectedSlotId: string;
    onSelect: (id: string) => void;
    onNext: () => void;
}) {
    function formatSlotDate(start: Date, end: Date) {
        const opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
        const s = new Date(start).toLocaleDateString("en-IN", opts);
        const e = new Date(end).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
        return `${s} – ${e}`;
    }

    function getAvailability(slot: IEventSlot) {
        if (slot.capacity === 0) return { label: "Unlimited", full: false };
        const remaining = Math.max(0, slot.capacity - slot.registrationCount);
        if (remaining === 0) return { label: "Full", full: true };
        return { label: `${remaining} seat${remaining !== 1 ? "s" : ""} left`, full: false };
    }

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-zinc-900">Choose a Time Slot</h2>
                <p className="text-sm text-zinc-500 mt-1">Select the date and time you'd like to attend.</p>
            </div>
            <div className="space-y-3">
                {slots.map((slot) => {
                    const { label: availLabel, full } = getAvailability(slot);
                    const isSelected = selectedSlotId === slot._id;
                    return (
                        <button
                            key={slot._id}
                            type="button"
                            disabled={full}
                            onClick={() => onSelect(slot._id)}
                            className={[
                                "w-full text-left p-4 rounded-xl border-2 transition-all duration-150",
                                full
                                    ? "border-zinc-100 bg-zinc-50 opacity-50 cursor-not-allowed"
                                    : isSelected
                                    ? "border-orange-500 bg-orange-50"
                                    : "border-zinc-200 bg-white hover:border-zinc-300",
                            ].join(" ")}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    {slot.label && (
                                        <p className="text-sm font-semibold text-zinc-900 mb-0.5">{slot.label}</p>
                                    )}
                                    <p className={`text-sm ${slot.label ? "text-zinc-500" : "font-medium text-zinc-900"}`}>
                                        {formatSlotDate(slot.start, slot.end)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                        full ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"
                                    }`}>
                                        {availLabel}
                                    </span>
                                    {isSelected && !full && (
                                        <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center">
                                            <IconCheck size={10} className="text-white" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
            <div className="flex justify-end pt-1">
                <Button
                    onClick={() => {
                        if (!selectedSlotId) { toast.error("Please select a time slot."); return; }
                        onNext();
                    }}
                    className="bg-primary hover:bg-primary/80 text-primary-foreground"
                >
                    Continue <IconArrowRight size={15} className="ml-1.5" />
                </Button>
            </div>
        </div>
    );
}

// ─── Step 1: Team ─────────────────────────────────────────────────────────────

function TeamStep({
    event, leaderName, setLeaderName, leaderEmail, members, setMembers, onNext,
}: {
    event: IEvent; leaderName: string; setLeaderName: (v: string) => void;
    leaderEmail: string; members: { name: string; email: string }[];
    setMembers: (m: { name: string; email: string }[]) => void; onNext: () => void;
}) {
    const totalMin = event.teamSize?.min ?? 2;
    const totalMax = event.teamSize?.max ?? 2;
    const minTeammates = totalMin - 1;
    const maxTeammates = totalMax - 1;

    function validate() {
        if (!leaderName.trim()) { toast.error("Please enter your name."); return false; }
        for (let i = 0; i < members.length; i++) {
            if (!members[i].name.trim()) { toast.error(`Please enter a name for Teammate ${i + 2}.`); return false; }
            if (!members[i].email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(members[i].email)) {
                toast.error(`Please enter a valid email for Teammate ${i + 2}.`); return false;
            }
            if (members[i].email.toLowerCase() === leaderEmail.toLowerCase()) {
                toast.error(`Teammate ${i + 2}'s email cannot be the same as yours.`); return false;
            }
        }
        if (members.length < minTeammates) {
            toast.error(`You need at least ${minTeammates} teammate${minTeammates !== 1 ? "s" : ""}.`); return false;
        }
        return true;
    }

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-zinc-900">Team Details</h2>
                <p className="text-sm text-zinc-500 mt-1">
                    This event requires a team of <strong>{totalMin}–{totalMax} members</strong> total.
                    Add {minTeammates}–{maxTeammates} teammate{maxTeammates !== 1 ? "s" : ""} — your spot is already counted.
                </p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 flex items-start gap-2">
                <IconUsers size={16} className="text-orange-400 shrink-0 mt-0.5" />
                <p className="text-xs text-orange-700">You are the team leader. Your ticket is already included. Teammates will receive their ticket via email.</p>
            </div>
            <div className="space-y-3">
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-zinc-700">Teammate 1</span>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">You · Leader</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs mb-1">Name</Label><Input value={leaderName} onChange={(e) => setLeaderName(e.target.value)} placeholder="Your name" className="h-9 bg-white" /></div>
                        <div><Label className="text-xs mb-1">Email</Label><Input type="email" value={leaderEmail} disabled className="h-9 bg-zinc-100 text-zinc-400 cursor-not-allowed" /></div>
                    </div>
                </div>
                {members.map((m, i) => (
                    <div key={i} className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-zinc-700">Teammate {i + 2}</span>
                            {members.length > minTeammates && (
                                <button type="button" onClick={() => setMembers(members.filter((_, idx) => idx !== i))} className="p-1 text-zinc-400 hover:text-red-500 transition-colors">
                                    <IconTrash size={15} />
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><Label className="text-xs mb-1">Name</Label><Input value={m.name} onChange={(e) => setMembers(members.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} placeholder="Full name" className="h-9 bg-white" /></div>
                            <div><Label className="text-xs mb-1">Email</Label><Input type="email" value={m.email} onChange={(e) => setMembers(members.map((x, idx) => idx === i ? { ...x, email: e.target.value } : x))} placeholder="email@example.com" className="h-9 bg-white" /></div>
                        </div>
                    </div>
                ))}
            </div>
            {members.length < maxTeammates && (
                <button type="button" onClick={() => setMembers([...members, { name: "", email: "" }])} className="flex items-center gap-2 w-full justify-center py-2.5 border-2 border-dashed border-zinc-200 rounded-xl text-sm text-zinc-500 hover:border-primary/40 hover:text-primary transition-colors">
                    <IconPlus size={15} /> Add teammate ({members.length + 2} of {maxTeammates + 1} max)
                </button>
            )}
            <div className="flex justify-end pt-1">
                <Button onClick={() => { if (validate()) onNext(); }} className="bg-primary hover:bg-primary/80 text-primary-foreground">
                    Continue <IconArrowRight size={15} className="ml-1.5" />
                </Button>
            </div>
        </div>
    );
}

// ─── Step 2: Custom form ───────────────────────────────────────────────────────

function FormStep({
    event, responses, setResponses, onBack, onNext,
}: {
    event: IEvent; responses: Record<string, string>;
    setResponses: (r: Record<string, string>) => void; onBack: () => void; onNext: () => void;
}) {
    function validate() {
        for (const field of event.customForm) {
            if (field.isRequired && !responses[field._id]?.trim()) {
                toast.error(`"${field.label}" is required.`); return false;
            }
        }
        return true;
    }

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-zinc-900">Additional Details</h2>
                <p className="text-sm text-zinc-500 mt-1">Please fill in the registration form below.</p>
            </div>
            {(event as any).registrationInstructions && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900 [&_a]:underline [&_a]:text-amber-700 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_code]:bg-amber-100 [&_code]:px-1 [&_code]:rounded">
                    <MDPreview source={(event as any).registrationInstructions} style={{ background: "transparent", color: "inherit", fontSize: "inherit" }} />
                </div>
            )}
            <div className="space-y-4">
                {event.customForm.map((field) => (
                    <div key={field._id}>
                        <Label className="text-sm font-medium text-zinc-800">
                            {field.label}{field.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <div className="mt-1.5">
                            {field.type === "long_text" ? (
                                <textarea rows={3} value={responses[field._id] ?? ""} onChange={(e) => setResponses({ ...responses, [field._id]: e.target.value })} placeholder={field.placeholder ?? ""} className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                            ) : field.type === "dropdown" ? (
                                <select value={responses[field._id] ?? ""} onChange={(e) => setResponses({ ...responses, [field._id]: e.target.value })} className="w-full h-9 text-sm border border-zinc-200 rounded-lg px-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
                                    <option value="">Select an option…</option>
                                    {field.options?.map((o, i) => <option key={i} value={o}>{o}</option>)}
                                </select>
                            ) : (
                                <Input value={responses[field._id] ?? ""} onChange={(e) => setResponses({ ...responses, [field._id]: e.target.value })} placeholder={field.placeholder ?? ""} className="h-9" />
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex justify-between pt-1">
                <Button variant="outline" onClick={onBack}><IconArrowLeft size={15} className="mr-1.5" /> Back</Button>
                <Button onClick={() => { if (validate()) onNext(); }} className="bg-primary hover:bg-primary/80 text-primary-foreground">
                    Continue <IconArrowRight size={15} className="ml-1.5" />
                </Button>
            </div>
        </div>
    );
}

// ─── Step 3: Review ────────────────────────────────────────────────────────────

function ReviewStep({
    event, leaderName, leaderEmail, members, responses,
    selectedSlot, onBack, onSubmit, submitting, paymentError, onRetryPayment,
    provider,
}: {
    event: IEvent; leaderName: string; leaderEmail: string;
    members: { name: string; email: string }[]; responses: Record<string, string>;
    selectedSlot?: IEventSlot;
    onBack: () => void; onSubmit: () => void; submitting: boolean;
    paymentError: string | null; onRetryPayment: () => void;
    provider: "cashfree" | "hdfc";
}) {
    const teamSize = event.isTeamEvent ? members.length + 1 : 1;
    const totalPrice = (event as any).pricePerPerson && event.isTeamEvent
        ? event.price * teamSize
        : event.price;
    const isPaid = event.price > 0;

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-zinc-900">Review & Confirm</h2>
                <p className="text-sm text-zinc-500 mt-1">Check your details before {isPaid ? "paying" : "registering"}.</p>
            </div>

            {/* Event card */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-semibold text-zinc-900">{event.title}</h3>
                <p className="text-xs text-zinc-400">
                    {selectedSlot
                        ? new Date(selectedSlot.start).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
                        : new Date(event.date.start).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
                    {event.venue && ` · ${event.venue}`}
                </p>
                {selectedSlot?.label && (
                    <p className="text-xs text-orange-600 font-medium">{selectedSlot.label}</p>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
                    <span className="text-sm text-zinc-600">Entry fee</span>
                    <span className="text-sm font-semibold">
                        {event.price === 0 ? (
                            <span className="text-green-600">Free</span>
                        ) : (event as any).pricePerPerson && event.isTeamEvent ? (
                            <span>₹{event.price}/person × {teamSize} = <strong>₹{totalPrice}</strong></span>
                        ) : (
                            `₹${event.price}`
                        )}
                    </span>
                </div>
            </div>

            {/* Team */}
            {event.isTeamEvent && members.length > 0 && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-zinc-900 mb-3">Your Team ({members.length + 1} members)</h3>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-zinc-800">{leaderName || "You"}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-zinc-400 text-xs truncate max-w-40">{leaderEmail}</span>
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Leader</span>
                            </div>
                        </div>
                        {members.map((m, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                                <span className="font-medium text-zinc-800">{m.name}</span>
                                <span className="text-zinc-400 text-xs truncate max-w-45">{m.email}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Form responses */}
            {event.customForm?.length > 0 && Object.values(responses).some(Boolean) && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-zinc-900 mb-3">Your Responses</h3>
                    <div className="space-y-2">
                        {event.customForm.map((field) => responses[field._id] && (
                            <div key={field._id} className="text-sm">
                                <span className="text-zinc-400">{field.label}: </span>
                                <span className="text-zinc-800 font-medium">{responses[field._id]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Payment notice */}
            {isPaid && !paymentError && (
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                    <IconCreditCard size={16} className="shrink-0 mt-0.5 text-blue-400" />
                    <span>You&apos;ll be redirected to HDFC SmartGateway to complete payment of <strong>₹{totalPrice}</strong> via UPI. Your ticket is confirmed only after successful payment.</span>
                </div>
            )}

            {/* Payment error with retry */}
            {paymentError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-2">
                        <IconAlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
                        <div>
                            <p className="text-sm font-semibold text-red-700">Payment failed</p>
                            <p className="text-xs text-red-500 mt-0.5">{paymentError}</p>
                        </div>
                    </div>
                    <Button onClick={onRetryPayment} disabled={submitting} size="sm" className="w-full bg-red-600 hover:bg-red-500 text-white">
                        {submitting ? <><IconLoader2 size={14} className="animate-spin mr-2" /> Opening payment…</> : <><IconRefresh size={14} className="mr-2" /> Try Again</>}
                    </Button>
                </div>
            )}

            {/* Actions */}
            {!paymentError && (
                <div className="flex justify-between pt-1">
                    <Button variant="outline" onClick={onBack} disabled={submitting}>
                        <IconArrowLeft size={15} className="mr-1.5" /> Back
                    </Button>
                    <Button onClick={onSubmit} disabled={submitting} className="bg-primary hover:bg-primary/80 text-primary-foreground font-semibold">
                        {submitting ? (
                            <><IconLoader2 size={15} className="animate-spin mr-2" />{isPaid ? "Opening payment…" : "Registering…"}</>
                        ) : isPaid ? (
                            <><IconCreditCard size={15} className="mr-2" /> Pay ₹{totalPrice}</>
                        ) : (
                            <><IconTicket size={15} className="mr-2" /> Confirm Registration</>
                        )}
                    </Button>
                </div>
            )}

            {paymentError && (
                <button onClick={onBack} className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors w-full text-center">
                    ← Go back and edit details
                </button>
            )}
        </div>
    );
}

// ─── Confirmation screen ───────────────────────────────────────────────────────

function ConfirmationScreen({ event, ticketCount }: { event: IEvent; ticketCount: number }) {
    const whatsappLink = (event as any).whatsappLink as string | undefined;
    return (
        <div className="text-center py-8 space-y-5">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <IconCheck size={32} className="text-green-600" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-zinc-900">You&apos;re registered!</h2>
                <p className="text-sm text-zinc-500 mt-2 max-w-sm mx-auto">
                    {ticketCount > 1 ? `${ticketCount} tickets generated and sent via email.` : "Your ticket has been sent to your email. See you at the event!"}
                </p>
            </div>
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 max-w-sm mx-auto text-left">
                <p className="text-sm font-semibold text-zinc-900">{event.title}</p>
                <p className="text-xs text-zinc-400 mt-1">
                    {new Date(event.date.start).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long" })}
                    {event.venue && ` · ${event.venue}`}
                </p>
            </div>
            {whatsappLink && (
                <div className="max-w-sm mx-auto">
                    <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-5 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        Join WhatsApp Group
                    </a>
                </div>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
                <Link href="/dashboard" className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/80 text-primary-foreground text-sm font-semibold rounded-xl transition-colors">
                    <IconTicket size={15} /> View My Tickets
                </Link>
                <Link href="/events" className="px-5 py-2.5 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-xl hover:bg-zinc-50 transition-colors">
                    Browse More
                </Link>
            </div>
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
    const { slug } = useParams<{ slug: string }>();
    const router = useRouter();
    const { data: session, status } = useSession();

    const [event, setEvent] = useState<IEvent | null>(null);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState(0);
    const [done, setDone] = useState(false);
    const [ticketCount, setTicketCount] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const provider = "hdfc" as const;

    const [members, setMembers] = useState<{ name: string; email: string }[]>([]);
    const [responses, setResponses] = useState<Record<string, string>>({});
    const [leaderName, setLeaderName] = useState("");
    const [selectedSlotId, setSelectedSlotId] = useState("");

    // Pre-load Cashfree SDK for paid events
    useEffect(() => {
        if (event && event.price > 0) loadCashfreeScript().catch(() => {});
    }, [event]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace(`/auth/login?callbackUrl=/events/${slug}/register`); return;
        }
        if (status === "loading") return;
        getEventBySlug(slug as string).then((data) => {
            if (!data || data.status !== "published") { router.replace(`/events/${slug}`); return; }
            if (data.externalRegistrationUrl) { router.replace(`/events/${slug}`); return; }
            setEvent(data);
            setLeaderName(session?.user?.name ?? "");
            if (data.isTeamEvent && data.teamSize) {
                setMembers(Array.from({ length: data.teamSize.min - 1 }, () => ({ name: "", email: "" })));
            }
            setLoading(false);
        });
    }, [slug, status]);

    const steps: string[] = [];
    if ((event?.slots?.length ?? 0) > 0) steps.push("Slot");
    if (event?.isTeamEvent) steps.push("Team");
    if ((event?.customForm?.length ?? 0) > 0) steps.push("Details");
    steps.push("Confirm");

    function buildFormResponses(): IFormResponse[] {
        return (event?.customForm ?? []).map((field) => ({ fieldId: field._id, value: responses[field._id] ?? "" }));
    }

    async function handleFreeSubmit() {
        if (!event) return;
        setSubmitting(true);
        const result = await createRegistration({
            eventId: event._id.toString(),
            slotId: selectedSlotId || undefined,
            teamMembers: event.isTeamEvent ? members : [],
            formResponses: buildFormResponses(),
        });
        setSubmitting(false);
        if (result.success) { setTicketCount((result.data as any)?.tickets?.length ?? 1); setDone(true); }
        else toast.error(result.error ?? "Registration failed. Please try again.");
    }

    const handlePaidSubmit = useCallback(async () => {
        if (!event || !session?.user) return;
        setSubmitting(true);
        setPaymentError(null);

        const formResponses = buildFormResponses();
        const teamMembersPayload = event.isTeamEvent ? members : [];

        // ── Create order (provider-aware) ──────────────────────────────────────
        let orderData: { provider: string; orderId: string; paymentSessionId?: string; paymentLink?: string; amount: number };
        try {
            const res = await fetch("/api/payment/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eventId: event._id.toString(), provider, teamSize: teamMembersPayload.length + 1 }),
            });
            const json = await res.json();
            if (!json.success) { setSubmitting(false); toast.error(json.error ?? "Failed to initiate payment."); return; }
            orderData = json.data;
        } catch {
            setSubmitting(false); toast.error("Network error. Please try again."); return;
        }

        // ── HDFC: save context to sessionStorage and redirect ──────────────────
        if (provider === "hdfc" && orderData.paymentLink) {
            sessionStorage.setItem("hdfc_pending", JSON.stringify({
                eventId: event._id.toString(),
                eventTitle: event.title,
                whatsappLink: (event as any).whatsappLink || undefined,
                slotId: selectedSlotId || undefined,
                teamMembers: teamMembersPayload,
                formResponses,
            }));
            window.location.href = orderData.paymentLink;
            return; // page will unload; no need to setSubmitting(false)
        }

        setSubmitting(false);

        // ── Cashfree: open SDK modal ───────────────────────────────────────────
        const sdkLoaded = await loadCashfreeScript();
        if (!sdkLoaded) {
            toast.error("Failed to load payment gateway. Please check your connection and try again.");
            return;
        }

        const cashfree = window.Cashfree({
            mode: process.env.NEXT_PUBLIC_CASHFREE_ENV === "production" ? "production" : "sandbox",
        });

        const result = await cashfree.checkout({
            paymentSessionId: orderData.paymentSessionId!,
            redirectTarget: "_modal",
        });

        if (result.error) {
            const msg = result.error.message ?? "";
            const isCancelled = msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("close");
            setPaymentError(
                isCancelled
                    ? "Payment was cancelled. Your registration has not been confirmed. You can try again."
                    : msg || "Payment failed. Please try again."
            );
            return;
        }

        if (result.paymentDetails) {
            setSubmitting(true);
            try {
                const verifyRes = await fetch("/api/payment/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        orderId: orderData.orderId,
                        provider: "cashfree",
                        eventId: event._id.toString(),
                        slotId: selectedSlotId || undefined,
                        teamMembers: teamMembersPayload,
                        formResponses,
                    }),
                });
                const verifyJson = await verifyRes.json();
                setSubmitting(false);
                if (verifyJson.success) {
                    setTicketCount(verifyJson.data?.ticketCount ?? 1);
                    setPaymentError(null);
                    setDone(true);
                } else {
                    setPaymentError(verifyJson.error ?? `Payment received (Order: ${orderData.orderId}) but registration failed. Please contact support.`);
                }
            } catch {
                setSubmitting(false);
                setPaymentError(`Payment received (Order: ${orderData.orderId}) but we couldn't confirm your registration. Please contact support.`);
            }
        }
    }, [event, session, members, responses, provider]);

    async function handleSubmit() {
        if (!event) return;
        if (event.price > 0) await handlePaidSubmit();
        else await handleFreeSubmit();
    }

    if (loading || status === "loading") {
        return (
            <div className="min-h-screen bg-zinc-50">
                {/* <Navbar /> */}
                <div className="max-w-lg mx-auto px-4 py-12 animate-pulse space-y-4">
                    <div className="h-5 bg-zinc-100 rounded w-1/3" />
                    <div className="h-64 bg-white border border-zinc-200 rounded-2xl" />
                </div>
            </div>
        );
    }

    if (!event) return null;

    return (
        <div className="min-h-screen bg-zinc-50">
            {/* <Navbar /> */}
            <main className="max-w-lg mx-auto px-4 py-8">
                {!done && (
                    <Link href={`/events/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 mb-6 transition-colors">
                        <IconArrowLeft size={15} /> {event.title}
                    </Link>
                )}
                <div className="bg-white rounded-2xl border border-zinc-200 p-6">
                    {done ? (
                        <ConfirmationScreen event={event} ticketCount={ticketCount} />
                    ) : (
                        <>
                            {steps.length > 1 && <Steps current={step} steps={steps} />}
                            {(() => {
                                let idx = 0;
                                const hasSlots = (event.slots?.length ?? 0) > 0;
                                const isTeam = event.isTeamEvent;
                                const hasForm = (event.customForm?.length ?? 0) > 0;

                                if (hasSlots && step === idx) return (
                                    <SlotStep
                                        slots={event.slots ?? []}
                                        selectedSlotId={selectedSlotId}
                                        onSelect={setSelectedSlotId}
                                        onNext={() => setStep(s => s + 1)}
                                    />
                                );
                                if (hasSlots) idx++;

                                if (isTeam && step === idx) return (
                                    <TeamStep event={event} leaderName={leaderName} setLeaderName={setLeaderName} leaderEmail={session?.user?.email ?? ""} members={members} setMembers={setMembers} onNext={() => setStep(s => s + 1)} />
                                );
                                if (isTeam) idx++;

                                if (hasForm && step === idx) return (
                                    <FormStep event={event} responses={responses} setResponses={setResponses} onBack={() => setStep(s => s - 1)} onNext={() => setStep(s => s + 1)} />
                                );
                                if (hasForm) idx++;

                                const chosenSlot = event.slots?.find((s) => s._id === selectedSlotId);
                                return (
                                    <ReviewStep
                                        event={event} leaderName={leaderName} leaderEmail={session?.user?.email ?? ""}
                                        members={members} responses={responses}
                                        selectedSlot={chosenSlot}
                                        onBack={() => { setPaymentError(null); setStep(s => s - 1); }}
                                        onSubmit={handleSubmit} submitting={submitting}
                                        paymentError={paymentError} onRetryPayment={handlePaidSubmit}
                                        provider={provider}
                                    />
                                );
                            })()}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}