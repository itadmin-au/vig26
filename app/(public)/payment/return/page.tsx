// app/(public)/payment/return/page.tsx
// Landing page for HDFC SmartGateway redirect after payment.
// HDFC redirects here with the order_id in query params.
// We read the pending registration context from sessionStorage, call verify, then show result.
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { IconCheck, IconAlertCircle, IconLoader2, IconTicket } from "@tabler/icons-react";

type State = "loading" | "success" | "failed" | "error";

function HdfcReturnInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [state, setState] = useState<State>("loading");
    const [errorMsg, setErrorMsg] = useState("");
    const [ticketCount, setTicketCount] = useState(1);
    const [eventTitle, setEventTitle] = useState("");
    const [whatsappLink, setWhatsappLink] = useState<string | undefined>(undefined);

    useEffect(() => {
        // Juspay/HDFC may use different param names depending on integration version
        const orderId =
            searchParams.get("order_id") ??
            searchParams.get("orderId") ??
            searchParams.get("merchantOrderId") ??
            searchParams.get("merchant_order_id") ??
            "";

        if (!orderId) {
            setState("error");
            setErrorMsg("No order ID found in the return URL. Please contact support.");
            return;
        }

        // Retrieve registration context saved to sessionStorage before the HDFC redirect
        const raw = sessionStorage.getItem("hdfc_pending");
        if (!raw) {
            setState("error");
            setErrorMsg("Registration context not found. If you completed payment, please check your email or contact support with your order ID: " + orderId);
            return;
        }

        let pending: {
            type?: "registration" | "add_member";
            eventId?: string;
            eventTitle: string;
            whatsappLink?: string;
            leaderUsn?: string;
            teamMembers?: { name: string; email: string; usn?: string }[];
            formResponses?: { fieldId: string; value: string }[];
            // add_member fields
            registrationId?: string;
            memberName?: string;
            memberEmail?: string;
            memberUsn?: string;
        };

        try {
            pending = JSON.parse(raw);
        } catch {
            setState("error");
            setErrorMsg("Could not read registration context. Contact support with order ID: " + orderId);
            return;
        }

        setEventTitle(pending.eventTitle ?? "");
        setWhatsappLink(pending.whatsappLink);

        // Handle add-member payment flow
        if (pending.type === "add_member") {
            fetch("/api/payment/verify-add-member", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId,
                    registrationId: pending.registrationId,
                    memberName: pending.memberName,
                    memberEmail: pending.memberEmail,
                    memberUsn: pending.memberUsn,
                }),
            })
                .then((res) => res.json())
                .then((json) => {
                    if (json.success) {
                        sessionStorage.removeItem("hdfc_pending");
                        setState("success");
                    } else {
                        setState("failed");
                        setErrorMsg(json.error ?? "Payment verification failed. Contact support with order ID: " + orderId);
                    }
                })
                .catch(() => {
                    setState("error");
                    setErrorMsg("Network error while verifying payment. Contact support with order ID: " + orderId);
                });
            return;
        }

        // Call verify API (standard registration flow)
        fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                orderId,
                provider: "hdfc",
                eventId: pending.eventId,
                leaderUsn: pending.leaderUsn,
                teamMembers: pending.teamMembers ?? [],
                formResponses: pending.formResponses ?? [],
            }),
        })
            .then((res) => res.json())
            .then((json) => {
                if (json.success) {
                    sessionStorage.removeItem("hdfc_pending");
                    setTicketCount(json.data?.ticketCount ?? 1);
                    setState("success");
                } else {
                    setState("failed");
                    setErrorMsg(json.error ?? "Payment verification failed. Contact support with order ID: " + orderId);
                }
            })
            .catch(() => {
                setState("error");
                setErrorMsg("Network error while verifying payment. Contact support with order ID: " + orderId);
            });
    }, [searchParams]);

    if (state === "loading") {
        return (
            <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <IconLoader2 size={36} className="animate-spin text-primary mx-auto" />
                    <p className="text-zinc-600 font-medium">Confirming your payment…</p>
                    <p className="text-sm text-zinc-400">Please do not close this page.</p>
                </div>
            </div>
        );
    }

    if (state === "success") {
        return (
            <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
                <div className="bg-white border border-zinc-200 rounded-2xl p-8 max-w-md w-full text-center space-y-5">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                        <IconCheck size={32} className="text-green-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-zinc-900">
                            {ticketCount === 0 ? "Member added!" : "You're registered!"}
                        </h1>
                        <p className="text-sm text-zinc-500 mt-2">
                            {ticketCount === 0
                                ? "The new team member has been added and their ticket sent via email."
                                : ticketCount > 1
                                    ? `${ticketCount} tickets generated and sent via email.`
                                    : "Your ticket has been sent to your email. See you at the event!"}
                        </p>
                    </div>
                    {eventTitle && (
                        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-left">
                            <p className="text-sm font-semibold text-zinc-900">{eventTitle}</p>
                        </div>
                    )}
                    {whatsappLink && (
                        <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full px-5 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-semibold rounded-xl transition-colors"
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            Join WhatsApp Group
                        </a>
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
            </div>
        );
    }

    // failed or error
    return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
            <div className="bg-white border border-zinc-200 rounded-2xl p-8 max-w-md w-full text-center space-y-5">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                    <IconAlertCircle size={32} className="text-red-500" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-zinc-900">
                        {state === "failed" ? "Payment not completed" : "Something went wrong"}
                    </h1>
                    <p className="text-sm text-zinc-500 mt-2">{errorMsg}</p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                        onClick={() => router.back()}
                        className="px-5 py-2.5 bg-primary hover:bg-primary/80 text-primary-foreground text-sm font-semibold rounded-xl transition-colors"
                    >
                        Try Again
                    </button>
                    <Link href="/events" className="px-5 py-2.5 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-xl hover:bg-zinc-50 transition-colors">
                        Browse Events
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function HdfcReturnPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
                <IconLoader2 size={36} className="animate-spin text-primary" />
            </div>
        }>
            <HdfcReturnInner />
        </Suspense>
    );
}
