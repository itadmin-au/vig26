"use client";

import { useState, useRef, useEffect } from "react";

const TYPES = [
    { value: "all", label: "All" },
    { value: "inter", label: "Inter-college" },
    { value: "intra", label: "Intra-college" },
];

const CATEGORIES = [
    { value: "all", label: "All" },
    { value: "tech", label: "Tech" },
    { value: "cultural", label: "Cultural" },
    { value: "hackathon", label: "Hackathon" },
];

export function DownloadReportButton() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [type, setType] = useState("all");
    const [category, setCategory] = useState("all");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    async function handleDownload() {
        setLoading(true);
        setOpen(false);
        try {
            const params = new URLSearchParams();
            if (type !== "all") params.set("type", type);
            if (category !== "all") params.set("category", category);
            const qs = params.toString();
            const res = await fetch("/api/report" + (qs ? "?" + qs : ""));
            if (!res.ok) throw new Error("Failed to generate report");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `vigyaanrang-2026-analytics-${new Date().toISOString().split("T")[0]}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Report generation failed:", err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => !loading && setOpen(o => !o)}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating…
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download Report
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? "rotate-180" : ""}`}>
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl border border-zinc-200 shadow-lg z-50 p-4 space-y-4">
                    <div>
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Event Type</p>
                        <div className="flex flex-wrap gap-1.5">
                            {TYPES.map(t => (
                                <button
                                    key={t.value}
                                    onClick={() => setType(t.value)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                        type === t.value
                                            ? "bg-zinc-900 text-white"
                                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Category</p>
                        <div className="flex flex-wrap gap-1.5">
                            {CATEGORIES.map(c => (
                                <button
                                    key={c.value}
                                    onClick={() => setCategory(c.value)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                        category === c.value
                                            ? "bg-zinc-900 text-white"
                                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                                    }`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleDownload}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Generate & Download
                    </button>
                </div>
            )}
        </div>
    );
}
