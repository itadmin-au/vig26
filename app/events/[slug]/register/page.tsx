// app/events/[slug]/register/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getEventBySlug } from "@/actions/events";
import { createRegistration } from "@/actions/registrations";
import { Navbar } from "@/components/navbar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    IconArrowLeft, IconArrowRight, IconCheck, IconUsers,
    IconTicket, IconLoader2, IconPlus, IconTrash, IconAlertCircle,
} from "@tabler/icons-react";
import type { IEvent, IFormResponse } from "@/types";

// ─── Step indicator ────────────────────────────────────────────────────────────

function Steps({ current, steps }: { current: number; steps: string[] }) {
    return (
        <div className="flex items-center mb-8">
            {steps.map((label, i) => (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                            i < current
                                ? "bg-primary text-primary-foreground"
                                : i === current
                                    ? "bg-zinc-900 text-white"
                                    : "bg-zinc-100 text-zinc-400"
                        }`}>
                            {i < current ? <IconCheck size={14} /> : i + 1}
                        </div>
                        <span className={`text-xs font-medium hidden sm:block ${i === current ? "text-zinc-900" : "text-zinc-400"}`}>
                            {label}
                        </span>
                    </div>
                    {i < steps.length - 1 && (
                        <div className={`h-px flex-1 mx-2 transition-colors ${i < current ? "bg-primary/40" : "bg-zinc-200"}`} />
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── Step 1: Team members ──────────────────────────────────────────────────────

function TeamStep({
    event,
    leaderName,
    setLeaderName,
    leaderEmail,
    members,
    setMembers,
    onNext,
}: {
    event: IEvent;
    leaderName: string;
    setLeaderName: (v: string) => void;
    leaderEmail: string;
    members: { name: string; email: string }[];
    setMembers: (m: { name: string; email: string }[]) => void;
    onNext: () => void;
}) {
    // Total team size as configured by admin (includes the leader)
    const totalMin = event.teamSize?.min ?? 2;
    const totalMax = event.teamSize?.max ?? 5;
    // Teammates to add = total minus leader
    const minTeammates = totalMin - 1;
    const maxTeammates = totalMax - 1;

    function addMember() {
        if (members.length < maxTeammates) {
            setMembers([...members, { name: "", email: "" }]);
        }
    }

    function removeMember(i: number) {
        setMembers(members.filter((_, idx) => idx !== i));
    }

    function updateMember(i: number, field: "name" | "email", value: string) {
        setMembers(members.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
    }

    function validate() {
        if (members.length < minTeammates) {
            toast.error(
                `Minimum team size is ${totalMin}. Please add at least ${minTeammates} teammate${minTeammates !== 1 ? "s" : ""}.`
            );
            return false;
        }
        for (const m of members) {
            if (!m.name.trim() || !m.email.trim()) {
                toast.error("Please fill in all teammate details.");
                return false;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) {
                toast.error(`Invalid email: ${m.email}`);
                return false;
            }
        }
        return true;
    }

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-zinc-900">Team Members</h2>
                <p className="text-sm text-zinc-500 mt-1">
                    This event requires a team of <strong>{totalMin}–{totalMax} members</strong> total.
                    Add {minTeammates}–{maxTeammates} teammate{maxTeammates !== 1 ? "s" : ""} — your spot is already counted.
                </p>
            </div>

            <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 flex items-start gap-2">
                <IconUsers size={16} className="text-orange-400 shrink-0 mt-0.5" />
                <p className="text-xs text-orange-700">
                    You are the team leader. Your ticket is already included. Teammates will receive their ticket via email.
                </p>
            </div>

            <div className="space-y-3">
                {/* Leader — Teammate 1 */}
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-zinc-700">Teammate 1</span>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">You · Leader</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs mb-1">Name</Label>
                            <Input
                                value={leaderName}
                                onChange={(e) => setLeaderName(e.target.value)}
                                placeholder="Your name"
                                className="h-9 bg-white"
                            />
                        </div>
                        <div>
                            <Label className="text-xs mb-1">Email</Label>
                            <Input
                                type="email"
                                value={leaderEmail}
                                disabled
                                className="h-9 bg-zinc-100 text-zinc-400 cursor-not-allowed"
                            />
                        </div>
                    </div>
                </div>

                {/* Additional teammates — start from Teammate 2 */}
                {members.map((m, i) => (
                    <div key={i} className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-zinc-700">Teammate {i + 2}</span>
                            {members.length > minTeammates && (
                                <button
                                    type="button"
                                    onClick={() => removeMember(i)}
                                    className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                                >
                                    <IconTrash size={15} />
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs mb-1">Name</Label>
                                <Input
                                    value={m.name}
                                    onChange={(e) => updateMember(i, "name", e.target.value)}
                                    placeholder="Full name"
                                    className="h-9 bg-white"
                                />
                            </div>
                            <div>
                                <Label className="text-xs mb-1">Email</Label>
                                <Input
                                    type="email"
                                    value={m.email}
                                    onChange={(e) => updateMember(i, "email", e.target.value)}
                                    placeholder="email@example.com"
                                    className="h-9 bg-white"
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {members.length < maxTeammates && (
                <button
                    type="button"
                    onClick={addMember}
                    className="flex items-center gap-2 w-full justify-center py-2.5 border-2 border-dashed border-zinc-200 rounded-xl text-sm text-zinc-500 hover:border-primary/40 hover:text-primary transition-colors"
                >
                    <IconPlus size={15} />
                    Add teammate ({members.length + 2} of {maxTeammates + 1} max)
                </button>
            )}

            <div className="flex justify-end pt-1">
                <Button
                    onClick={() => { if (validate()) onNext(); }}
                    className="bg-primary hover:bg-primary/80 text-primary-foreground"
                >
                    Continue <IconArrowRight size={15} className="ml-1.5" />
                </Button>
            </div>
        </div>
    );
}

// ─── Step 2: Custom form ───────────────────────────────────────────────────────

function FormStep({
    event,
    responses,
    setResponses,
    onBack,
    onNext,
}: {
    event: IEvent;
    responses: Record<string, string>;
    setResponses: (r: Record<string, string>) => void;
    onBack: () => void;
    onNext: () => void;
}) {
    function update(fieldId: string, value: string) {
        setResponses({ ...responses, [fieldId]: value });
    }

    function validate() {
        for (const field of event.customForm) {
            if (field.isRequired && !responses[field._id]?.trim()) {
                toast.error(`"${field.label}" is required.`);
                return false;
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

            <div className="space-y-4">
                {event.customForm.map((field) => (
                    <div key={field._id}>
                        <Label className="text-sm font-medium text-zinc-800">
                            {field.label}
                            {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <div className="mt-1.5">
                            {field.type === "long_text" ? (
                                <textarea
                                    rows={3}
                                    value={responses[field._id] ?? ""}
                                    onChange={(e) => update(field._id, e.target.value)}
                                    placeholder={field.placeholder ?? ""}
                                    className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60 resize-none"
                                />
                            ) : field.type === "dropdown" ? (
                                <select
                                    value={responses[field._id] ?? ""}
                                    onChange={(e) => update(field._id, e.target.value)}
                                    className="w-full h-9 text-sm border border-zinc-200 rounded-lg px-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="">Select an option…</option>
                                    {field.options?.map((o, i) => <option key={i} value={o}>{o}</option>)}
                                </select>
                            ) : field.type === "file_upload" ? (
                                <div className="border border-dashed border-zinc-200 rounded-lg px-4 py-3 text-sm text-zinc-400 bg-zinc-50">
                                    File upload available after completing registration.
                                </div>
                            ) : (
                                <Input
                                    value={responses[field._id] ?? ""}
                                    onChange={(e) => update(field._id, e.target.value)}
                                    placeholder={field.placeholder ?? ""}
                                    className="h-9"
                                />
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-between pt-1">
                <Button variant="outline" onClick={onBack}>
                    <IconArrowLeft size={15} className="mr-1.5" /> Back
                </Button>
                <Button
                    onClick={() => { if (validate()) onNext(); }}
                    className="bg-primary hover:bg-primary/80 text-primary-foreground"
                >
                    Continue <IconArrowRight size={15} className="ml-1.5" />
                </Button>
            </div>
        </div>
    );
}

// ─── Step 3: Review + confirm ─────────────────────────────────────────────────

function ReviewStep({
    event,
    leaderName,
    leaderEmail,
    members,
    responses,
    onBack,
    onSubmit,
    submitting,
}: {
    event: IEvent;
    leaderName: string;
    leaderEmail: string;
    members: { name: string; email: string }[];
    responses: Record<string, string>;
    onBack: () => void;
    onSubmit: () => void;
    submitting: boolean;
}) {
    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-zinc-900">Review & Confirm</h2>
                <p className="text-sm text-zinc-500 mt-1">Check your details before registering.</p>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-semibold text-zinc-900">{event.title}</h3>
                <p className="text-xs text-zinc-400">
                    {new Date(event.date.start).toLocaleDateString("en-IN", {
                        weekday: "short", day: "numeric", month: "long", year: "numeric",
                    })}
                    {event.venue && ` · ${event.venue}`}
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
                    <span className="text-sm text-zinc-600">Entry fee</span>
                    <span className="text-sm font-semibold">
                        {event.price === 0 ? <span className="text-green-600">Free</span> : `₹${event.price}`}
                    </span>
                </div>
            </div>

            {event.isTeamEvent && members.length > 0 && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-zinc-900 mb-3">
                        Your Team ({members.length + 1} members)
                    </h3>
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

            {event.price > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700">
                    <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                    Payment of ₹{event.price} will be collected at the event.
                </div>
            )}

            <div className="flex justify-between pt-1">
                <Button variant="outline" onClick={onBack}>
                    <IconArrowLeft size={15} className="mr-1.5" /> Back
                </Button>
                <Button
                    onClick={onSubmit}
                    disabled={submitting}
                    className="bg-primary hover:bg-primary/80 text-primary-foreground font-semibold"
                >
                    {submitting ? (
                        <><IconLoader2 size={15} className="animate-spin mr-2" /> Registering…</>
                    ) : (
                        <><IconTicket size={15} className="mr-2" /> Confirm Registration</>
                    )}
                </Button>
            </div>
        </div>
    );
}

// ─── Confirmation screen ───────────────────────────────────────────────────────

function ConfirmationScreen({ event, ticketCount }: { event: IEvent; ticketCount: number }) {
    return (
        <div className="text-center py-8 space-y-5">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <IconCheck size={32} className="text-green-600" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-zinc-900">You're registered!</h2>
                <p className="text-sm text-zinc-500 mt-2 max-w-sm mx-auto">
                    {ticketCount > 1
                        ? `${ticketCount} tickets generated and sent via email.`
                        : "Your ticket has been sent to your email. See you at the event!"}
                </p>
            </div>
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 max-w-sm mx-auto text-left">
                <p className="text-sm font-semibold text-zinc-900">{event.title}</p>
                <p className="text-xs text-zinc-400 mt-1">
                    {new Date(event.date.start).toLocaleDateString("en-IN", {
                        weekday: "short", day: "numeric", month: "long",
                    })}
                    {event.venue && ` · ${event.venue}`}
                </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/80 text-primary-foreground text-sm font-semibold rounded-xl transition-colors"
                >
                    <IconTicket size={15} />
                    View My Tickets
                </Link>
                <Link
                    href="/events"
                    className="px-5 py-2.5 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-xl hover:bg-zinc-50 transition-colors"
                >
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

    const [members, setMembers] = useState<{ name: string; email: string }[]>([]);
    const [responses, setResponses] = useState<Record<string, string>>({});
    const [leaderName, setLeaderName] = useState("");

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace(`/auth/login?callbackUrl=/events/${slug}/register`);
            return;
        }
        if (status === "loading") return;

        getEventBySlug(slug as string).then((data) => {
            if (!data || data.status !== "published") {
                router.replace(`/events/${slug}`);
                return;
            }
            setEvent(data);

            // Pre-fill leader name from session
            setLeaderName(session?.user?.name ?? "");

            // Seed exactly (totalMin - 1) teammate rows — excluding the leader
            if (data.isTeamEvent && data.teamSize) {
                const minTeammates = data.teamSize.min - 1;
                setMembers(Array.from({ length: minTeammates }, () => ({ name: "", email: "" })));
            }

            setLoading(false);
        });
    }, [slug, status]);

    const steps: string[] = [];
    if (event?.isTeamEvent) steps.push("Team");
    if ((event?.customForm?.length ?? 0) > 0) steps.push("Details");
    steps.push("Confirm");

    async function handleSubmit() {
        if (!event) return;
        setSubmitting(true);

        const formResponses: IFormResponse[] = event.customForm.map((field) => ({
            fieldId: field._id,
            value: responses[field._id] ?? "",
        }));

        const result = await createRegistration({
            eventId: event._id.toString(),
            teamMembers: event.isTeamEvent ? members : [],
            formResponses,
        });

        setSubmitting(false);

        if (result.success) {
            setTicketCount((result.data as any)?.tickets?.length ?? 1);
            setDone(true);
        } else {
            toast.error(result.error ?? "Registration failed. Please try again.");
        }
    }

    if (loading || status === "loading") {
        return (
            <div className="min-h-screen bg-zinc-50">
                <Navbar />
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
            <Navbar />
            <main className="max-w-lg mx-auto px-4 py-8">
                {!done && (
                    <Link
                        href={`/events/${slug}`}
                        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 mb-6 transition-colors"
                    >
                        <IconArrowLeft size={15} />
                        {event.title}
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
                                const isTeam = event.isTeamEvent;
                                const hasForm = (event.customForm?.length ?? 0) > 0;

                                if (isTeam && step === idx) {
                                    return (
                                        <TeamStep
                                            event={event}
                                            leaderName={leaderName}
                                            setLeaderName={setLeaderName}
                                            leaderEmail={session?.user?.email ?? ""}
                                            members={members}
                                            setMembers={setMembers}
                                            onNext={() => setStep(s => s + 1)}
                                        />
                                    );
                                }
                                if (isTeam) idx++;

                                if (hasForm && step === idx) {
                                    return (
                                        <FormStep
                                            event={event}
                                            responses={responses}
                                            setResponses={setResponses}
                                            onBack={() => setStep(s => s - 1)}
                                            onNext={() => setStep(s => s + 1)}
                                        />
                                    );
                                }
                                if (hasForm) idx++;

                                return (
                                    <ReviewStep
                                        event={event}
                                        leaderName={leaderName}
                                        leaderEmail={session?.user?.email ?? ""}
                                        members={members}
                                        responses={responses}
                                        onBack={() => setStep(s => s - 1)}
                                        onSubmit={handleSubmit}
                                        submitting={submitting}
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