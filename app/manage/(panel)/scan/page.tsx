// app/manage/(panel)/scan/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { verifyTicketQR, toggleAttendance } from "@/actions/registrations";
import { toast } from "sonner";
import {
    IconQrcode,
    IconCheck,
    IconLoader2,
    IconCamera,
    IconCameraOff,
    IconKeyboard,
    IconRefresh,
    IconCalendarEvent,
    IconMapPin,
    IconAlertCircle,
    IconCircleCheck,
    IconScan,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VerifiedTicket {
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
}

type ScanState =
    | { status: "idle" }
    | { status: "loading"; qrCode: string }
    | { status: "success"; ticket: VerifiedTicket }
    | { status: "already_checked_in"; ticket: VerifiedTicket }
    | { status: "error"; message: string };

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({
    state,
    onMarkAttendance,
    onReset,
    markingAttendance,
}: {
    state: Extract<ScanState, { status: "success" | "already_checked_in" | "error" }>;
    onMarkAttendance: () => void;
    onReset: () => void;
    markingAttendance: boolean;
}) {
    if (state.status === "error") {
        return (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                    <IconAlertCircle size={28} className="text-red-500" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-red-700">Invalid Ticket</p>
                    <p className="text-xs text-red-500 mt-1">{state.message}</p>
                </div>
                <Button
                    onClick={onReset}
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                    size="sm"
                >
                    <IconRefresh size={14} className="mr-1.5" />
                    Scan Again
                </Button>
            </div>
        );
    }

    const ticket = state.ticket;
    const alreadyIn = state.status === "already_checked_in";
    const event = ticket.eventId;
    const user = ticket.userId;

    return (
        <div className={cn(
            "rounded-2xl border p-5 space-y-4",
            alreadyIn ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"
        )}>
            {/* Status banner */}
            <div className="flex items-center gap-3">
                <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                    alreadyIn ? "bg-amber-100" : "bg-green-100"
                )}>
                    {alreadyIn
                        ? <IconCircleCheck size={22} className="text-amber-500" />
                        : <IconCheck size={22} className="text-green-600" />
                    }
                </div>
                <div>
                    <p className={cn(
                        "text-sm font-bold",
                        alreadyIn ? "text-amber-800" : "text-green-800"
                    )}>
                        {alreadyIn ? "Already Checked In" : "Valid Ticket"}
                    </p>
                    {alreadyIn && ticket.checkedInAt && (
                        <p className="text-xs text-amber-600 mt-0.5">
                            at {new Date(ticket.checkedInAt).toLocaleTimeString("en-IN", {
                                hour: "2-digit", minute: "2-digit",
                            })}
                        </p>
                    )}
                </div>
            </div>

            <div className={cn("h-px", alreadyIn ? "bg-amber-200" : "bg-green-200")} />

            {/* Participant info */}
            <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                    <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
                        alreadyIn ? "bg-amber-200 text-amber-700" : "bg-green-200 text-green-700"
                    )}>
                        {user.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900">{user.name}</p>
                        <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                        {user.collegeId && (
                            <p className="text-xs text-zinc-400 font-mono mt-0.5">{user.collegeId}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                    <IconCalendarEvent size={13} className="text-zinc-400 shrink-0" />
                    <span className="font-medium truncate">{event.title}</span>
                </div>

                {event.venue && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <IconMapPin size={13} className="text-zinc-400 shrink-0" />
                        <span>{event.venue}</span>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full capitalize",
                        ticket.teamRole === "leader" ? "bg-blue-100 text-blue-700"
                            : ticket.teamRole === "member" ? "bg-purple-100 text-purple-700"
                                : "bg-zinc-100 text-zinc-600"
                    )}>
                        {ticket.teamRole}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                        …{ticket.qrCode.slice(-8)}
                    </span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
                {!alreadyIn && (
                    <Button
                        onClick={onMarkAttendance}
                        disabled={markingAttendance}
                        className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold"
                        size="sm"
                    >
                        {markingAttendance
                            ? <><IconLoader2 size={14} className="mr-1.5 animate-spin" />Marking…</>
                            : <><IconCheck size={14} className="mr-1.5" />Mark as Attended</>
                        }
                    </Button>
                )}
                <Button
                    onClick={onReset}
                    variant="outline"
                    size="sm"
                    className={cn(alreadyIn ? "flex-1" : "")}
                >
                    <IconRefresh size={14} className="mr-1.5" />
                    {alreadyIn ? "Scan Next" : "Cancel"}
                </Button>
            </div>
        </div>
    );
}

// ─── Camera Scanner ───────────────────────────────────────────────────────────

function CameraScanner({ onScan, active }: { onScan: (qr: string) => void; active: boolean }) {
    const scannerRef = useRef<any>(null);
    const hasScanned = useRef(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [loadingCamera, setLoadingCamera] = useState(false);

    const stopScanner = useCallback(async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch { /* ignore */ }
            scannerRef.current = null;
        }
    }, []);

    const startScanner = useCallback(async () => {
        if (scannerRef.current) return;
        setLoadingCamera(true);
        setCameraError(null);
        hasScanned.current = false;

        try {
            // Dynamically load html5-qrcode — no npm install needed
            if (!(window as any).Html5Qrcode) {
                await new Promise<void>((resolve, reject) => {
                    const script = document.createElement("script");
                    script.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
                    script.onload = () => resolve();
                    script.onerror = () => reject(new Error("Failed to load QR scanner library"));
                    document.head.appendChild(script);
                });
            }

            const scanner = new (window as any).Html5Qrcode("qr-reader");
            scannerRef.current = scanner;

            await scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 220, height: 220 } },
                (decoded: string) => {
                    if (hasScanned.current) return;
                    hasScanned.current = true;
                    const match = decoded.match(/\/verify\/([a-f0-9-]{36})/i);
                    onScan(match ? match[1] : decoded.trim());
                },
                () => { /* per-frame decode errors — ignore */ }
            );

            setLoadingCamera(false);
        } catch (err: any) {
            setLoadingCamera(false);
            if (err.name === "NotAllowedError" || err.message?.includes("Permission")) {
                setCameraError("Camera permission denied. Please allow access and retry.");
            } else if (err.name === "NotFoundError") {
                setCameraError("No camera found on this device.");
            } else {
                setCameraError(err.message ?? "Failed to start camera.");
            }
        }
    }, [onScan]);

    useEffect(() => {
        if (active) {
            startScanner();
        } else {
            stopScanner();
        }
        return () => { stopScanner(); };
    }, [active, startScanner, stopScanner]);

    useEffect(() => {
        if (active) hasScanned.current = false;
    }, [active]);

    if (cameraError) {
        return (
            <div className="flex flex-col items-center justify-center h-60 bg-zinc-50 rounded-xl border border-zinc-200 gap-3 px-6 text-center">
                <IconCameraOff size={30} className="text-zinc-300" />
                <p className="text-sm text-zinc-500">{cameraError}</p>
                <Button
                    onClick={() => { setCameraError(null); startScanner(); }}
                    variant="outline"
                    size="sm"
                >
                    <IconRefresh size={14} className="mr-1.5" /> Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="relative">
            {loadingCamera && (
                <div
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-50 rounded-xl border border-zinc-200 gap-2"
                    style={{ minHeight: 260 }}
                >
                    <IconLoader2 size={28} className="text-zinc-400 animate-spin" />
                    <p className="text-xs text-zinc-500">Starting camera…</p>
                </div>
            )}

            {/* html5-qrcode mounts video here; hide its default UI chrome */}
            <div className="relative overflow-hidden rounded-xl bg-zinc-900" style={{ minHeight: 260 }}>
                <div
                    id="qr-reader"
                    className="w-full [&>img]:hidden [&>div>button]:hidden [&>div>select]:hidden"
                />

                {/* Scanning frame overlay */}
                {!loadingCamera && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="relative w-52 h-52">
                            <span className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-orange-400 rounded-tl" />
                            <span className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-orange-400 rounded-tr" />
                            <span className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-orange-400 rounded-bl" />
                            <span className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-orange-400 rounded-br" />
                            <span
                                className="absolute left-2 right-2 h-0.5 bg-orange-400/80 rounded-full"
                                style={{ animation: "scanLine 2s ease-in-out infinite" }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <p className="text-center text-xs text-zinc-400 mt-2">
                Point camera at a Vigyanrang QR ticket
            </p>

            <style>{`
                @keyframes scanLine {
                    0%   { top: 8px; }
                    50%  { top: 188px; }
                    100% { top: 8px; }
                }
            `}</style>
        </div>
    );
}

// ─── Manual Input ─────────────────────────────────────────────────────────────

function ManualInput({ onScan, disabled }: { onScan: (qr: string) => void; disabled: boolean }) {
    const [value, setValue] = useState("");

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) return;
        const match = trimmed.match(/\/verify\/([a-f0-9-]{36})/i);
        onScan(match ? match[1] : trimmed);
        setValue("");
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center">
                    <IconQrcode size={32} className="text-zinc-300" />
                </div>
                <p className="text-sm text-zinc-500 text-center max-w-xs">
                    Paste the raw QR code UUID or the full{" "}
                    <span className="font-mono text-zinc-700">/verify/…</span> URL
                </p>
            </div>
            <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="3f4a9c12-…  or  vigyanrang.com/verify/…"
                    disabled={disabled}
                    className="flex-1 font-mono text-sm"
                    autoComplete="off"
                    spellCheck={false}
                />
                <Button
                    type="submit"
                    disabled={disabled || !value.trim()}
                    className="bg-orange-500 hover:bg-orange-400 text-white shrink-0"
                >
                    Verify
                </Button>
            </form>
        </div>
    );
}

// ─── Session Stats ────────────────────────────────────────────────────────────

function SessionStats({
    scanned,
    checkedIn,
    alreadyIn,
    onReset,
}: {
    scanned: number;
    checkedIn: number;
    alreadyIn: number;
    onReset: () => void;
}) {
    return (
        <div className="bg-white rounded-xl border border-zinc-200 px-4 py-3">
            <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-medium text-zinc-500">This session</span>
                <button
                    onClick={onReset}
                    className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                    Reset
                </button>
            </div>
            <div className="grid grid-cols-3 divide-x divide-zinc-100">
                <div className="text-center pr-4">
                    <p className="text-2xl font-bold text-zinc-900">{scanned}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">Scanned</p>
                </div>
                <div className="text-center px-4">
                    <p className="text-2xl font-bold text-green-600">{checkedIn}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">Checked in</p>
                </div>
                <div className="text-center pl-4">
                    <p className="text-2xl font-bold text-amber-500">{alreadyIn}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">Already in</p>
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManageScanPage() {
    const [mode, setMode] = useState<"camera" | "manual">("camera");
    const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
    const [markingAttendance, setMarkingAttendance] = useState(false);
    const [stats, setStats] = useState({ scanned: 0, checkedIn: 0, alreadyIn: 0 });

    const isResultState =
        scanState.status === "success" ||
        scanState.status === "already_checked_in" ||
        scanState.status === "error";

    const isLoading = scanState.status === "loading";
    const cameraActive = mode === "camera" && scanState.status === "idle";

    async function handleQRCode(qrCode: string) {
        if (scanState.status === "loading") return;
        setScanState({ status: "loading", qrCode });

        const result = await verifyTicketQR(qrCode);

        if (!result.success || !result.data) {
            setScanState({ status: "error", message: result.error ?? "Ticket not found." });
            return;
        }

        const ticket = result.data as unknown as VerifiedTicket;

        if (ticket.attendanceStatus) {
            setStats(prev => ({ ...prev, scanned: prev.scanned + 1, alreadyIn: prev.alreadyIn + 1 }));
            setScanState({ status: "already_checked_in", ticket });
        } else {
            setStats(prev => ({ ...prev, scanned: prev.scanned + 1 }));
            setScanState({ status: "success", ticket });
        }
    }

    async function handleMarkAttendance() {
        if (scanState.status !== "success") return;
        setMarkingAttendance(true);

        const result = await toggleAttendance(scanState.ticket._id);
        setMarkingAttendance(false);

        if (result.success) {
            setStats(prev => ({ ...prev, checkedIn: prev.checkedIn + 1 }));
            toast.success(`${scanState.ticket.userId.name} checked in!`);
            setScanState({
                status: "already_checked_in",
                ticket: {
                    ...scanState.ticket,
                    attendanceStatus: true,
                    checkedInAt: new Date().toISOString(),
                },
            });
        } else {
            toast.error(result.error ?? "Failed to mark attendance.");
        }
    }

    function reset() {
        setScanState({ status: "idle" });
    }

    return (
        <div className="max-w-lg mx-auto space-y-5">

            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                    <IconScan size={20} className="text-orange-500" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-zinc-900">QR Scanner</h1>
                    <p className="text-sm text-zinc-500">Scan tickets to mark attendance</p>
                </div>
            </div>

            {/* Stats — visible after first scan */}
            {stats.scanned > 0 && (
                <SessionStats
                    scanned={stats.scanned}
                    checkedIn={stats.checkedIn}
                    alreadyIn={stats.alreadyIn}
                    onReset={() => setStats({ scanned: 0, checkedIn: 0, alreadyIn: 0 })}
                />
            )}

            {/* Mode toggle */}
            <div className="flex bg-zinc-100 rounded-xl p-1 gap-1">
                {(["camera", "manual"] as const).map((m) => (
                    <button
                        key={m}
                        onClick={() => { setMode(m); reset(); }}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all",
                            mode === m
                                ? "bg-white text-zinc-900 shadow-sm"
                                : "text-zinc-500 hover:text-zinc-700"
                        )}
                    >
                        {m === "camera"
                            ? <><IconCamera size={16} />Camera</>
                            : <><IconKeyboard size={16} />Manual</>
                        }
                    </button>
                ))}
            </div>

            {/* Main card */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-4 space-y-4">

                {/* Loading */}
                {isLoading && scanState.status === "loading" && (
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <IconLoader2 size={32} className="text-orange-500 animate-spin" />
                        <p className="text-sm text-zinc-500">Verifying ticket…</p>
                        <p className="text-xs text-zinc-400 font-mono truncate max-w-xs">
                            {scanState.qrCode}
                        </p>
                    </div>
                )}

                {/* Result */}
                {isResultState && (
                    <ResultCard
                        state={scanState as any}
                        onMarkAttendance={handleMarkAttendance}
                        onReset={reset}
                        markingAttendance={markingAttendance}
                    />
                )}

                {/* Camera */}
                {!isResultState && !isLoading && mode === "camera" && (
                    <CameraScanner onScan={handleQRCode} active={cameraActive} />
                )}

                {/* Manual */}
                {!isResultState && !isLoading && mode === "manual" && (
                    <ManualInput
                        onScan={handleQRCode}
                        disabled={isLoading}
                    />
                )}
            </div>

            <p className="text-xs text-zinc-400 text-center">
                Each participant has their own QR code — team members must be scanned individually.
            </p>
        </div>
    );
}