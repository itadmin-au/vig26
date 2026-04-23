// app/events/[slug]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { getEventBySlug } from "@/actions/events";
import { getUserRegistrationForEvent } from "@/actions/registrations";
import {
    IconCalendarEvent, IconMapPin, IconUsers, IconCurrencyRupee,
    IconArrowLeft, IconTicket, IconAlertCircle, IconClock, IconLayoutList, IconFlag,
} from "@tabler/icons-react";
import type { IEvent, IEventSlot, IEventRound } from "@/types";
import "@uiw/react-markdown-preview/markdown.css";

const MDPreview = dynamic(() => import("@uiw/react-markdown-preview"), { ssr: false });

function CategoryBadge({ category }: { category: string }) {
    const colors: Record<string, string> = {
        tech: "bg-blue-50 text-blue-700",
        cultural: "bg-purple-50 text-purple-700",
        workshop: "bg-amber-50 text-amber-700",
        hackathon: "bg-green-50 text-green-700",
        esports: "bg-indigo-50 text-indigo-700",
        sports: "bg-rose-50 text-rose-700",
    };
    return (
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${colors[category] ?? "bg-zinc-100 text-zinc-600"}`}>
            {category}
        </span>
    );
}


export default function EventDetailPage() {
    const { slug } = useParams<{ slug: string }>();
    const router = useRouter();
    const { data: session } = useSession();

    const [event, setEvent] = useState<IEvent | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRegistered, setIsRegistered] = useState(false);

    useEffect(() => {
        if (!slug) return;
        getEventBySlug(slug as string).then((data) => {
            setEvent(data);
            setLoading(false);
        });
    }, [slug]);

    useEffect(() => {
        if (!event || !session) return;
        getUserRegistrationForEvent(event._id.toString()).then(({ registered }) => {
            setIsRegistered(registered);
        });
    }, [event, session]);

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-50 pt-16">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-pulse">
                    <div className="h-64 bg-zinc-200 rounded-2xl mb-6" />
                    <div className="grid lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-4">
                            <div className="h-8 bg-zinc-100 rounded w-2/3" />
                            <div className="h-4 bg-zinc-100 rounded w-full" />
                            <div className="h-4 bg-zinc-100 rounded w-5/6" />
                        </div>
                        <div className="h-64 bg-zinc-100 rounded-2xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen bg-zinc-50 pt-16">
                <div className="text-center py-32">
                    <p className="text-zinc-500 font-medium text-lg">Event not found</p>
                    <Link href="/events" className="mt-4 inline-block text-sm text-orange-600 hover:underline">
                        ← Back to events
                    </Link>
                </div>
            </div>
        );
    }

    const start = new Date(event.date.start);
    const end = new Date(event.date.end);
    const now = new Date();
    const isOver = now > end;
    const slotsLeft = event.capacity > 0 ? event.capacity - event.registrationCount : null;
    const isFull = slotsLeft !== null && slotsLeft <= 0;
    const isCancelled = event.status === "cancelled";
    const dept = typeof event.department === "object" ? (event.department as any)?.name : null;

    const registerHref = session
        ? `/events/${slug}/register`
        : `/auth/login?callbackUrl=/events/${slug}/register`;

    return (
        <div className="min-h-screen bg-zinc-50 pt-16">
            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
                <Link
                    href="/events"
                    className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 mb-5 transition-colors"
                >
                    <IconArrowLeft size={15} />
                    All Events
                </Link>

                {event.coverImage && (
                    <div className="w-full h-56 sm:h-72 rounded-2xl overflow-hidden mb-6">
                        <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover" />
                    </div>
                )}

                <div className="grid lg:grid-cols-3 gap-6 items-start">
                    <div className="lg:col-span-2 space-y-5">
                        <div>
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                <CategoryBadge category={event.category} />
                                <span className="text-xs px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 capitalize font-medium">
                                    {event.type}
                                </span>
                                {isCancelled && (
                                    <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-medium">
                                        Cancelled
                                    </span>
                                )}
                                {dept && (
                                    <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-500">
                                        {dept}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 leading-tight">{event.title}</h1>
                        </div>

                        <div className="flex flex-wrap gap-4 py-4 border-y border-zinc-200">
                            <div className="flex items-center gap-2 text-sm text-zinc-600">
                                <IconCalendarEvent size={16} className="text-zinc-400" />
                                <span>
                                    {start.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}
                                    {" · "}
                                    {start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                                    {" – "}
                                    {start.toDateString() !== end.toDateString() && (
                                        end.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }) + ", "
                                    )}
                                    {end.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                                </span>
                            </div>
                            {event.venue && (
                                <div className="flex items-center gap-2 text-sm text-zinc-600">
                                    <IconMapPin size={16} className="text-zinc-400" />
                                    <span>{event.venue}</span>
                                </div>
                            )}
                            {event.isTeamEvent && event.teamSize && (
                                <div className="flex items-center gap-2 text-sm text-zinc-600">
                                    <IconUsers size={16} className="text-zinc-400" />
                                    <span>Team of {event.teamSize.min}–{event.teamSize.max}</span>
                                </div>
                            )}
                        </div>

                        {event.description && (
                            <div className="bg-white rounded-2xl border border-zinc-200 p-5">
                                <h2 className="text-sm font-semibold text-zinc-900 mb-3">About this event</h2>
                                <div className="prose prose-sm max-w-none text-zinc-600" data-color-mode="light">
                                    <MDPreview source={event.description} />
                                </div>
                            </div>
                        )}

                        {(event.slots?.length ?? 0) > 0 && (
                            <div className="bg-white rounded-2xl border border-zinc-200 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <IconLayoutList size={16} className="text-zinc-400" />
                                    <h2 className="text-sm font-semibold text-zinc-900">Available Time Slots</h2>
                                    <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full ml-auto">
                                        {event.slots!.length} slot{event.slots!.length !== 1 ? "s" : ""}
                                    </span>
                                </div>
                                <div className="space-y-2.5">
                                    {event.slots!.map((slot: IEventSlot) => {
                                        const slotStart = new Date(slot.start);
                                        const slotEnd = new Date(slot.end);
                                        const slotFull = slot.capacity > 0 && slot.registrationCount >= slot.capacity;
                                        const remaining = slot.capacity > 0 ? slot.capacity - slot.registrationCount : null;
                                        return (
                                            <div
                                                key={slot._id.toString()}
                                                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border px-4 py-3 ${slotFull ? "border-zinc-200 bg-zinc-50 opacity-60" : "border-zinc-200 bg-white"}`}
                                            >
                                                <div className="space-y-0.5">
                                                    {slot.label && (
                                                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{slot.label}</p>
                                                    )}
                                                    <p className="text-sm font-medium text-zinc-800">
                                                        {slotStart.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}
                                                    </p>
                                                    <p className="text-xs text-zinc-500">
                                                        {slotStart.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                                                        {" – "}
                                                        {slotEnd.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                                                    </p>
                                                </div>
                                                <div className="shrink-0">
                                                    {slotFull ? (
                                                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-500">Full</span>
                                                    ) : remaining !== null && remaining <= 10 ? (
                                                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">
                                                            {remaining} seat{remaining !== 1 ? "s" : ""} left
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-600">Open</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {(event.rounds?.length ?? 0) > 0 && (
                            <div className="bg-white rounded-2xl border border-zinc-200 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <IconFlag size={16} className="text-zinc-400" />
                                    <h2 className="text-sm font-semibold text-zinc-900">Event Rounds</h2>
                                    <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full ml-auto">
                                        {event.rounds!.length} round{event.rounds!.length !== 1 ? "s" : ""}
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {event.rounds!.map((round: IEventRound, idx: number) => {
                                        const rStart = new Date(round.start);
                                        const rEnd = new Date(round.end);
                                        const sameDay = rStart.toDateString() === rEnd.toDateString();
                                        return (
                                            <div key={round._id?.toString() ?? idx} className="flex gap-4 items-start rounded-xl border border-zinc-200 px-4 py-3">
                                                <div className="shrink-0 w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center mt-0.5">
                                                    <span className="text-xs font-bold text-orange-500">{idx + 1}</span>
                                                </div>
                                                <div className="flex-1 min-w-0 space-y-0.5">
                                                    <p className="text-sm font-semibold text-zinc-900">{round.label}</p>
                                                    <p className="text-xs text-zinc-500">
                                                        {rStart.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}
                                                        {" · "}
                                                        {rStart.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                                                        {" – "}
                                                        {sameDay
                                                            ? rEnd.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
                                                            : rEnd.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }) + ", " + rEnd.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
                                                        }
                                                    </p>
                                                    {round.venue && (
                                                        <p className="text-xs text-zinc-400 flex items-center gap-1">
                                                            <IconMapPin size={11} />
                                                            {round.venue}
                                                        </p>
                                                    )}
                                                    {round.description && (
                                                        <p className="text-xs text-zinc-500 italic mt-1">{round.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {event.rules && (
                            <div className="bg-white rounded-2xl border border-zinc-200 p-5">
                                <h2 className="text-sm font-semibold text-zinc-900 mb-3">Rules & Guidelines</h2>
                                <div className="prose prose-sm max-w-none text-zinc-600" data-color-mode="light">
                                    <MDPreview source={event.rules} />
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4 lg:sticky lg:top-20">
                        <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-sm text-zinc-500">
                                    <IconCurrencyRupee size={15} />
                                    Entry fee
                                </div>
                                <span className="text-xl font-bold text-zinc-900">
                                    {event.price === 0 ? (
                                        <span className="text-green-600">Free</span>
                                    ) : (event as any).pricePerPerson && event.isTeamEvent ? (
                                        `₹${event.price}/person`
                                    ) : (
                                        `₹${event.price}`
                                    )}
                                </span>
                            </div>

                            {event.capacity > 0 && (isFull || slotsLeft! <= 10) && (
                                <div>
                                    <div className="flex items-center justify-between text-sm mb-1.5">
                                        <span className="text-zinc-500">Availability</span>
                                        <span className={`font-medium ${isFull ? "text-red-500" : "text-amber-500"}`}>
                                            {isFull ? "Full" : `${slotsLeft} slot${slotsLeft !== 1 ? "s" : ""} left`}
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${isFull ? "bg-red-400" : "bg-amber-400"}`}
                                            style={{ width: `${Math.min(100, (event.registrationCount / event.capacity) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {(event.slots?.length ?? 0) > 1 ? (
                                <div className="flex items-start gap-2 text-sm bg-zinc-50 rounded-xl px-3 py-2.5">
                                    <IconLayoutList size={15} className="shrink-0 mt-0.5 text-zinc-400" />
                                    <div>
                                        <p className="font-medium text-zinc-700">{event.slots!.length} time slots available</p>
                                        <p className="text-xs text-zinc-500 mt-0.5">You'll choose a slot during registration</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start gap-2 text-sm text-zinc-500 bg-zinc-50 rounded-xl px-3 py-2.5">
                                    <IconClock size={15} className="shrink-0 mt-0.5 text-zinc-400" />
                                    <div>
                                        <p className="font-medium text-zinc-700">
                                            {start.toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}
                                            {start.toDateString() !== end.toDateString() && (
                                                " – " + end.toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" })
                                            )}
                                        </p>
                                        <p className="text-xs mt-0.5">
                                            {start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} –{" "}
                                            {end.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {event.isTeamEvent && event.teamSize && (
                                <div className="flex items-start gap-2 text-sm text-zinc-500 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                                    <IconUsers size={15} className="shrink-0 mt-0.5 text-blue-400" />
                                    <p className="text-blue-700 text-xs leading-relaxed">
                                        Team event · {event.teamSize.min}–{event.teamSize.max} members per team.
                                        Leader registers for the whole team.
                                    </p>
                                </div>
                            )}

                            {isCancelled ? (
                                <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                                    <IconAlertCircle size={15} className="shrink-0" />
                                    This event has been cancelled.
                                </div>
                            ) : isOver ? (
                                <button disabled className="w-full py-2.5 bg-zinc-100 text-zinc-400 text-sm font-semibold rounded-xl cursor-not-allowed">
                                    Event is Over
                                </button>
                            ) : isFull ? (
                                <button disabled className="w-full py-2.5 bg-zinc-100 text-zinc-400 text-sm font-semibold rounded-xl cursor-not-allowed">
                                    Fully Booked
                                </button>
                            ) : event.registrationsClosed ? (
                                <button disabled className="w-full py-2.5 bg-zinc-100 text-zinc-400 text-sm font-semibold rounded-xl cursor-not-allowed">
                                    Registrations Closed
                                </button>
                            ) : isRegistered ? (
                                <Link
                                    href="/dashboard"
                                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-primary hover:bg-primary/80 text-white text-sm font-semibold rounded-xl transition-colors"
                                >
                                    <IconTicket size={16} />
                                    View Ticket
                                </Link>
                            ) : event.externalRegistrationUrl ? (
                                <a
                                    href={event.externalRegistrationUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-xl transition-colors"
                                >
                                    <IconTicket size={16} />
                                    Register on Devfolio
                                </a>
                            ) : (
                                <Link
                                    href={registerHref}
                                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-xl transition-colors"
                                >
                                    <IconTicket size={16} />
                                    {session ? "Register Now" : "Sign in to Register"}
                                </Link>
                            )}

                            {!session && !isCancelled && !isOver && !isFull && !isRegistered && (
                                <p className="text-xs text-zinc-400 text-center">
                                    Already have an account?{" "}
                                    <Link href={`/auth/login?callbackUrl=/events/${slug}/register`} className="text-orange-500 hover:underline">
                                        Sign in
                                    </Link>
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}