"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import {
    getAllRegistrationsAdmin,
    cancelRegistrationAdmin,
    checkInTicketAdmin,
    getManagementEventsList,
    getEventWithCustomForm,
    getAllRegistrationsForEvent,
} from "@/actions/admin";
import {
    IconSearch,
    IconDownload,
    IconChevronLeft,
    IconChevronRight,
    IconChevronDown,
    IconFilter,
    IconLoader2,
    IconX,
    IconCopy,
    IconCheck,
    IconTicket,
    IconTable,
    IconPrinter,
} from "@tabler/icons-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { IFormField } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = ["all", "confirmed", "pending", "cancelled"] as const;
type StatusTab = typeof STATUS_TABS[number];

const PAYMENT_OPTIONS = [
    { value: "all", label: "All Payments" },
    { value: "completed", label: "Completed" },
    { value: "pending", label: "Pending" },
    { value: "failed", label: "Failed" },
    { value: "na", label: "N/A (Free)" },
];

const STANDARD_COLUMNS: { id: string; label: string }[] = [
    { id: "sno", label: "S.No" },
    { id: "name", label: "Name" },
    { id: "email", label: "Email" },
    { id: "college_id", label: "College ID" },
    { id: "event", label: "Event" },
    { id: "type", label: "Type" },
    { id: "team_id", label: "Team ID" },
    { id: "payment_status", label: "Payment Status" },
    { id: "transaction_id", label: "Transaction ID" },
    { id: "registered_at", label: "Registered At" },
    { id: "check_in", label: "Check-in" },
];

const DEFAULT_SELECTED = new Set([
    "sno", "name", "email", "college_id", "event", "type", "payment_status", "registered_at",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
    const cls =
        status === "confirmed" ? "bg-green-50 text-green-700"
            : status === "pending" ? "bg-yellow-50 text-yellow-700"
                : "bg-red-50 text-red-600";
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
}

function paymentBadge(ps: string) {
    const cls =
        ps === "completed" ? "bg-green-50 text-green-700"
            : ps === "pending" ? "bg-yellow-50 text-yellow-700"
                : ps === "na" ? "bg-zinc-100 text-zinc-500"
                    : "bg-red-50 text-red-600";
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{ps}</span>;
}

function getCellValue(reg: any, colId: string): string {
    const isMember = reg._rowType === "member";
    const member: any = reg._member;
    switch (colId) {
        case "sno": return "";
        case "name": return isMember ? (member?.name ?? "") : (reg.userId?.name ?? "");
        case "email": return isMember ? (member?.email ?? "") : (reg.userId?.email ?? "");
        case "college_id": return isMember ? (member?.usn ?? "") : (reg.userId?.collegeId ?? "");
        case "event": return reg.eventId?.title ?? "";
        case "type": return isMember ? "Member" : (reg.isTeamRegistration ? "Leader" : "Individual");
        case "team_id": return reg.teamId ?? "";
        case "payment_status": return isMember ? "" : (reg.paymentStatus ?? "");
        case "transaction_id": return isMember ? "" : (reg.paymentId ?? "");
        case "registered_at": return isMember ? "" : new Date(reg.createdAt).toLocaleDateString("en-IN");
        case "check_in": {
            if (isMember) return "";
            const tickets: any[] = reg.tickets ?? [];
            if (tickets.length === 0) return "";
            const checked = tickets.filter((t: any) => t.attendanceStatus).length;
            return `${checked}/${tickets.length}`;
        }
        default: {
            // Custom form fields are team-level (e.g. "Team Name") — same value for all rows
            const response = reg.formResponses?.find((r: any) => r.fieldId === colId);
            if (!response) return "";
            if (Array.isArray(response.value)) return response.value.join(", ");
            return String(response.value ?? "");
        }
    }
}

function downloadCSV(rows: any[]) {
    const headers = [
        "Registration ID", "Ticket ID(s)", "Name", "Email", "College ID",
        "Event", "Type", "Team ID",
        "Status", "Check-in", "Payment Status", "Transaction ID", "Registered At",
    ];
    const lines = [
        headers.map((h) => `"${h}"`).join(","),
        ...rows.map((r) => {
            const tickets: any[] = r.tickets ?? [];
            const checkedIn = tickets.filter((t: any) => t.attendanceStatus).length;
            return [
                r._id,
                tickets.map((t: any) => t.qrCode).join("; "),
                r.userId?.name ?? "",
                r.userId?.email ?? "",
                r.userId?.collegeId ?? "",
                r.eventId?.title ?? "",
                r.isTeamRegistration ? "Team" : "Individual",
                r.teamId ?? "",
                r.status,
                tickets.length > 0 ? `${checkedIn}/${tickets.length}` : "",
                r.paymentStatus,
                r.paymentId ?? "",
                new Date(r.createdAt).toLocaleString("en-IN"),
            ].map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",");
        }),
    ];
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registrations_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

const ROWS_PER_PAGE = 28;

type SheetColumn = { id: string; label: string; isBlank: boolean };

function esc(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function generateSheetHTML(opts: {
    rows: any[];
    columns: SheetColumn[];
    eventTitle: string;
    eventDate: string;
    eventVenue: string;
    departmentName: string;
    category: string;
    winner: string;
    runnerUp: string;
    baseUrl: string;
}) {
    const { rows, columns, eventTitle, eventDate, eventVenue, departmentName, category, winner, runnerUp, baseUrl } = opts;

    // Expand team registrations: leader row + one row per team member
    const expandedRows: any[] = [];
    for (const reg of rows) {
        expandedRows.push({ ...reg, _rowType: reg.isTeamRegistration ? "leader" : "solo" });
        if (reg.isTeamRegistration && reg.teamMembers?.length > 0) {
            for (const member of reg.teamMembers) {
                expandedRows.push({ ...reg, _rowType: "member", _member: member });
            }
        }
    }

    const chunks: any[][] = [];
    for (let i = 0; i < expandedRows.length; i += ROWS_PER_PAGE) {
        chunks.push(expandedRows.slice(i, i + ROWS_PER_PAGE));
    }
    if (chunks.length === 0) chunks.push([]);
    const totalPages = chunks.length;

    const headerCells = columns.map((c) => `<th>${esc(c.label)}</th>`).join("");

    const winnerBlock = `
  <div class="winner-box">
    <p class="winner-title">Winner Details</p>
    <table>
      <tr><td class="wl">Winner</td><td class="wv">${esc(winner)}</td></tr>
      <tr><td class="wl">Runner-up</td><td class="wv">${esc(runnerUp)}</td></tr>
    </table>
  </div>`;

    const pageSections = chunks.map((chunk, pageIdx) => {
        const startIdx = pageIdx * ROWS_PER_PAGE;

        const tableRows = chunk.map((reg, i) => {
            const rowNum = startIdx + i + 1;
            const cells = columns.map((c) => {
                if (c.isBlank) return `<td></td>`;
                const val = c.id === "sno" ? String(rowNum) : getCellValue(reg, c.id);
                return `<td>${esc(val)}</td>`;
            }).join("");
            const cls = reg._rowType === "member" ? ' class="member-row"' : "";
            return `<tr${cls}>${cells}</tr>`;
        }).join("");

        const isLast = pageIdx === totalPages - 1;

        return `<div class="page-section">
  <div class="hd">
    <div class="hd-top">
      <img src="${baseUrl}/atria_bg.png" class="hd-logo hd-logo-atria" alt="" />
      <div class="hd-text">
        <div class="hd-org">Atria Institute of Technology</div>
      </div>
      <img src="${baseUrl}/vigyaanrang.png" class="hd-logo hd-logo-vigyaan" alt="" />
    </div>
    <div class="hd-rule"></div>
    <div class="hd-meta">
      <div class="hd-fields">
        ${eventTitle ? `<span><b>Event</b> ${esc(eventTitle)}</span>` : ""}
        ${eventDate ? `<span><b>Date</b> ${esc(eventDate)}</span>` : ""}
        ${eventVenue ? `<span><b>Venue</b> ${esc(eventVenue)}</span>` : ""}
      </div>
      <div class="hd-pg">Participant List &nbsp;·&nbsp; Page ${pageIdx + 1} of ${totalPages}</div>
    </div>
  </div>
  <table class="pt">
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  ${isLast ? winnerBlock : ""}
</div>`;
    }).join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Participant List — ${esc(eventTitle)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; color: #111; background: #fff; }
  .page-section { padding: 18px 24px; page-break-after: always; }
  .page-section:last-child { page-break-after: avoid; }

  .hd { margin-bottom: 12px; }
  .hd-top { display: flex; align-items: center; gap: 12px; padding-bottom: 8px; }
  .hd-logo { height: 62px; width: auto; flex-shrink: 0; display: block; }
  .hd-logo-atria { filter: invert(1); }
  .hd-logo-vigyaan { filter: brightness(0); }
  @media print { .hd-logo-atria { filter: invert(1); print-color-adjust: exact; -webkit-print-color-adjust: exact; } .hd-logo-vigyaan { filter: brightness(0); print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  .hd-text { flex: 1; text-align: center; }
  .hd-org { font-size: 18pt; font-weight: 700; color: #111; line-height: 1.1; }
  .hd-rule { border: none; border-top: 2px solid #111; }
  .hd-meta { display: flex; align-items: center; justify-content: space-between; padding: 5px 0 8px; }
  .hd-fields { display: flex; gap: 24px; font-size: 9pt; color: #222; }
  .hd-fields b { font-weight: 700; margin-right: 3px; }
  .hd-pg { font-size: 8.5pt; color: #888; white-space: nowrap; }

  .pt { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 9pt; }
  .pt th { background: #f2f2f2; padding: 6px 9px; text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.05em; color: #555; font-weight: 700; border-top: 1.5px solid #bbb; border-bottom: 1.5px solid #bbb; border-right: 1px solid #d0d0d0; }
  .pt th:last-child { border-right: none; }
  .pt td { padding: 5px 9px; border-bottom: 1px solid #e4e4e4; border-right: 1px solid #ebebeb; color: #222; vertical-align: top; }
  .pt td:last-child { border-right: none; }
  .pt tr:last-child td { border-bottom: none; }
  .pt tr:nth-child(even):not(.member-row) td { background: #f8f8f8; }
  .member-row td { background: #f0f4ff; color: #444; border-bottom-color: #dde4f5; }
  .member-row td:first-child { border-left: 3px solid #a5b4fc; }

  .winner-box { margin-top: 10px; padding-top: 10px; border-top: 1px solid #ccc; }
  .winner-title { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #555; margin-bottom: 8px; }
  .winner-box table { border-collapse: collapse; }
  .winner-box td { padding: 6px 10px; font-size: 10.5pt; }
  .wl { font-weight: 700; color: #555; width: 100px; white-space: nowrap; }
  .wv { border-bottom: 1.5px solid #bbb; min-width: 220px; }

  @media print { .page-section { padding: 10px 16px; } }
</style>
</head>
<body>
${pageSections}
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    function handleCopy() {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }
    return (
        <button
            onClick={handleCopy}
            title="Copy ticket ID"
            className="ml-1 text-zinc-300 hover:text-orange-500 transition-colors shrink-0"
        >
            {copied ? <IconCheck size={12} className="text-green-500" /> : <IconCopy size={12} />}
        </button>
    );
}

// ─── DownloadSheetModal ───────────────────────────────────────────────────────

const TEAM_DEFAULT_SELECTED = new Set([
    "sno", "name", "email", "college_id", "team_id", "payment_status", "registered_at",
]);

function DownloadSheetModal({
    onClose,
    sheetData,
    customFormFields,
    eventDetails,
}: {
    onClose: () => void;
    sheetData: any[];
    customFormFields: IFormField[];
    eventDetails: { title: string; venue?: string; date?: { start: Date; end: Date }; department?: { name: string }; category?: string; isTeamEvent?: boolean };
}) {
    const isTeam = !!eventDetails?.isTeamEvent;
    const dataColumns = [
        ...STANDARD_COLUMNS,
        ...customFormFields.map((f) => ({ id: f._id, label: f.label })),
    ];

    const [columns, setColumns] = useState<SheetColumn[]>(
        () => dataColumns
            .filter((c) => (isTeam ? TEAM_DEFAULT_SELECTED : DEFAULT_SELECTED).has(c.id))
            .map((c) => ({ id: c.id, label: c.label, isBlank: false }))
    );
    const [blankLabel, setBlankLabel] = useState("");
    const [winner, setWinner] = useState("");
    const [runnerUp, setRunnerUp] = useState("");

    const selectedDataIds = new Set(columns.filter((c) => !c.isBlank).map((c) => c.id));
    const availableStd = STANDARD_COLUMNS.filter((c) => !selectedDataIds.has(c.id));
    const availableCustom = customFormFields
        .map((f) => ({ id: f._id, label: f.label }))
        .filter((c) => !selectedDataIds.has(c.id));

    function addDataCol(col: { id: string; label: string }) {
        setColumns((prev) => [...prev, { ...col, isBlank: false }]);
    }

    function addBlankCol() {
        const label = blankLabel.trim();
        if (!label) return;
        setColumns((prev) => [...prev, { id: `blank_${Date.now()}`, label, isBlank: true }]);
        setBlankLabel("");
    }

    function removeCol(id: string) {
        setColumns((prev) => prev.filter((c) => c.id !== id));
    }

    function moveUp(idx: number) {
        if (idx === 0) return;
        setColumns((prev) => {
            const next = [...prev];
            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
            return next;
        });
    }

    function moveDown(idx: number) {
        setColumns((prev) => {
            if (idx >= prev.length - 1) return prev;
            const next = [...prev];
            [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
            return next;
        });
    }

    function updateBlankLabel(id: string, label: string) {
        setColumns((prev) => prev.map((c) => c.id === id ? { ...c, label } : c));
    }

    function handleDownload() {
        if (columns.length === 0) return;
        let eventDate = "";
        if (eventDetails?.date) {
            const d = eventDetails.date as any;
            const start = d.start ? new Date(d.start).toLocaleDateString("en-IN") : "";
            const end = d.end ? new Date(d.end).toLocaleDateString("en-IN") : "";
            eventDate = start === end || !end ? start : `${start} – ${end}`;
        }
        const html = generateSheetHTML({
            rows: sheetData,
            columns,
            eventTitle: eventDetails?.title ?? "",
            eventDate,
            eventVenue: eventDetails?.venue ?? "",
            departmentName: eventDetails?.department?.name ?? "",
            category: eventDetails?.category ?? "",
            winner,
            runnerUp,
            baseUrl: window.location.origin,
        });
        const win = window.open("", "_blank");
        if (win) { win.document.write(html); win.document.close(); }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                        <IconTable size={18} className="text-orange-500" />
                        <h2 className="text-base font-semibold text-zinc-900">Configure Sheet</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors">
                        <IconX size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex min-h-0">
                    {/* Left panel — available fields + blank column creator */}
                    <div className="w-52 shrink-0 border-r border-zinc-100 flex flex-col">
                        <p className="px-4 pt-4 pb-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Fields</p>
                        {isTeam && (() => {
                            const MEMBER_COLS = ["name", "email", "college_id"] as const;
                            const missingMemberCols = MEMBER_COLS.filter(
                                (id) => !columns.some((c) => c.id === id)
                            );
                            return (
                                <div className="mx-3 mb-2 px-2.5 py-1.5 rounded-lg bg-blue-50 text-[10px] leading-snug space-y-1.5">
                                    <p className="text-blue-600">
                                        Team event — <b>Name</b>, <b>Email</b>, <b>College ID</b> auto-fill per member row.
                                    </p>
                                    {missingMemberCols.length > 0 && (
                                        <button
                                            onClick={() => {
                                                const toAdd = STANDARD_COLUMNS.filter((c) =>
                                                    missingMemberCols.includes(c.id as any)
                                                );
                                                setColumns((prev) => [
                                                    ...prev,
                                                    ...toAdd.map((c) => ({ ...c, isBlank: false })),
                                                ]);
                                            }}
                                            className="w-full text-left font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-2"
                                        >
                                            + Add missing member columns
                                        </button>
                                    )}
                                </div>
                            );
                        })()}
                        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
                            {availableStd.length > 0 && (
                                <>
                                    <p className="text-[9px] font-semibold text-zinc-300 uppercase tracking-wider px-2 pt-2 pb-1">Standard</p>
                                    {availableStd.map((col) => (
                                        <button
                                            key={col.id}
                                            onClick={() => addDataCol(col)}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-zinc-600 hover:bg-orange-50 hover:text-orange-700 transition-colors group text-left"
                                        >
                                            <span className="w-3.5 h-3.5 rounded border border-zinc-200 group-hover:border-orange-300 group-hover:bg-orange-100 flex items-center justify-center shrink-0 text-[9px] text-zinc-300 group-hover:text-orange-500 leading-none">+</span>
                                            {col.label}
                                        </button>
                                    ))}
                                </>
                            )}
                            {availableCustom.length > 0 && (
                                <>
                                    <p className="text-[9px] font-semibold text-zinc-300 uppercase tracking-wider px-2 pt-3 pb-1">Form Fields</p>
                                    {availableCustom.map((col) => (
                                        <button
                                            key={col.id}
                                            onClick={() => addDataCol(col)}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-zinc-600 hover:bg-orange-50 hover:text-orange-700 transition-colors group text-left"
                                        >
                                            <span className="w-3.5 h-3.5 rounded border border-zinc-200 group-hover:border-orange-300 group-hover:bg-orange-100 flex items-center justify-center shrink-0 text-[9px] text-zinc-300 group-hover:text-orange-500 leading-none">+</span>
                                            {col.label}
                                        </button>
                                    ))}
                                </>
                            )}
                            {availableStd.length === 0 && availableCustom.length === 0 && (
                                <p className="text-[11px] text-zinc-300 text-center py-4 italic px-2">All fields added</p>
                            )}
                        </div>

                        {/* Blank column creator */}
                        <div className="border-t border-zinc-100 p-3">
                            <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">Add blank column</p>
                            <div className="flex gap-1.5">
                                <input
                                    value={blankLabel}
                                    onChange={(e) => setBlankLabel(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && addBlankCol()}
                                    placeholder="e.g. Signature"
                                    className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                                />
                                <button
                                    onClick={addBlankCol}
                                    disabled={!blankLabel.trim()}
                                    className="px-2.5 py-1.5 text-xs font-medium bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right panel — column order */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <p className="px-5 pt-4 pb-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
                            Column order <span className="text-zinc-300 normal-case font-normal tracking-normal">· {columns.length} column{columns.length !== 1 ? "s" : ""}</span>
                        </p>
                        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
                            {columns.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-zinc-300 text-xs text-center gap-1 py-8">
                                    <span className="text-2xl">←</span>
                                    Add fields from the left panel
                                </div>
                            ) : columns.map((col, idx) => (
                                <div
                                    key={col.id}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-100 hover:border-zinc-200 transition-colors"
                                >
                                    <span className="text-[10px] text-zinc-300 w-5 text-right shrink-0 font-mono tabular-nums">{idx + 1}</span>

                                    {col.isBlank ? (
                                        <input
                                            value={col.label}
                                            onChange={(e) => updateBlankLabel(col.id, e.target.value)}
                                            className="flex-1 min-w-0 text-sm bg-transparent border-b border-dashed border-zinc-300 focus:outline-none focus:border-orange-400 text-zinc-700 py-0.5"
                                        />
                                    ) : (
                                        <span className="flex-1 min-w-0 text-sm text-zinc-700 truncate">{col.label}</span>
                                    )}

                                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 ${
                                        col.isBlank
                                            ? "bg-amber-50 text-amber-600 border border-amber-200"
                                            : "bg-zinc-100 text-zinc-400"
                                    }`}>
                                        {col.isBlank ? "blank" : "data"}
                                    </span>

                                    <div className="flex gap-0.5 shrink-0">
                                        <button
                                            onClick={() => moveUp(idx)}
                                            disabled={idx === 0}
                                            className="p-1 rounded text-zinc-300 hover:text-zinc-600 hover:bg-zinc-200 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 9V3M3 6l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </button>
                                        <button
                                            onClick={() => moveDown(idx)}
                                            disabled={idx === columns.length - 1}
                                            className="p-1 rounded text-zinc-300 hover:text-zinc-600 hover:bg-zinc-200 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 3v6M9 6l-3 3-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </button>
                                        <button
                                            onClick={() => removeCol(col.id)}
                                            className="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                            <IconX size={10} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Winner details */}
                        <div className="border-t border-zinc-100 px-5 py-3">
                            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">Winner Details</p>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    value={winner}
                                    onChange={(e) => setWinner(e.target.value)}
                                    placeholder="Winner…"
                                    className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                                />
                                <input
                                    type="text"
                                    value={runnerUp}
                                    onChange={(e) => setRunnerUp(e.target.value)}
                                    placeholder="Runner-up…"
                                    className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-100 bg-zinc-50/60 rounded-b-2xl">
                    <p className="text-xs text-zinc-400">{sheetData.length} registration{sheetData.length !== 1 ? "s" : ""}</p>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-3 py-1.5 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50">
                            Cancel
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={columns.length === 0 || sheetData.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <IconPrinter size={14} />
                            Print / Save PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── TicketAccordion ──────────────────────────────────────────────────────────

function TicketAccordion({ reg, onCancel, cancelling, onCheckIn, checkingIn }: {
    reg: any;
    onCancel: (id: string) => void;
    cancelling: string | null;
    onCheckIn: (ticketId: string, regId: string) => void;
    checkingIn: string | null;
}) {
    const tickets: any[] = (reg.tickets ?? [])
        .slice()
        .sort((a: any, b: any) => a._id.localeCompare(b._id));

    const memberTickets = tickets.filter((t) => t.teamRole === "member");
    const teamMembers: any[] = reg.teamMembers ?? [];

    return (
        <div className="px-5 pb-4 pt-0">
            <div className="border border-zinc-100 rounded-lg overflow-hidden divide-y divide-zinc-100">
                {tickets.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-zinc-400 italic">No tickets found.</p>
                ) : tickets.map((t: any) => {
                    let displayEmail: string | null = t.userId?.email ?? null;
                    let displayName: string | null = t.userId?.name ?? null;
                    const hasAccount = !!t.userId?._id || !!t.userId?.email;

                    if (!hasAccount && t.teamRole === "member") {
                        const memberIdx = memberTickets.findIndex((mt: any) => mt._id === t._id);
                        const member = teamMembers[memberIdx];
                        if (member) {
                            displayEmail = member.email ?? null;
                            displayName = member.name ?? null;
                        }
                    }

                    return (
                        <div key={t._id} className="px-4 py-3 flex items-start gap-3 text-sm bg-white hover:bg-zinc-50/50 transition-colors">
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 capitalize shrink-0 mt-0.5">
                                {t.teamRole}
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 flex-wrap">
                                    <span className="text-xs font-mono text-zinc-400 break-all">{t.qrCode}</span>
                                    <CopyButton text={t.qrCode} />
                                    {t.attendanceStatus ? (
                                        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 shrink-0">
                                            ✓ checked in{t.checkedInAt ? ` · ${new Date(t.checkedInAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}
                                        </span>
                                    ) : (
                                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-400 shrink-0">not checked in</span>
                                    )}
                                </div>
                                {displayName ? (
                                    <p className="text-zinc-700 mt-0.5">{displayName}</p>
                                ) : null}
                                {displayEmail ? (
                                    <p className={`text-xs truncate ${hasAccount ? "text-zinc-400" : "text-amber-500"}`}>
                                        {displayEmail}
                                        {!hasAccount && (
                                            <span className="ml-1 font-medium">· no account</span>
                                        )}
                                    </p>
                                ) : (
                                    <p className="text-xs text-zinc-300 italic">No user linked</p>
                                )}
                            </div>
                            <button
                                onClick={() => onCheckIn(t._id, reg._id)}
                                disabled={checkingIn === t._id}
                                className={`shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                    t.attendanceStatus
                                        ? "border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-red-500 hover:border-red-200"
                                        : "border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
                                }`}
                            >
                                {checkingIn === t._id ? (
                                    <IconLoader2 size={11} className="animate-spin" />
                                ) : t.attendanceStatus ? (
                                    <IconX size={11} />
                                ) : (
                                    <IconCheck size={11} />
                                )}
                                {checkingIn === t._id ? "…" : t.attendanceStatus ? "Undo" : "Check In"}
                            </button>
                        </div>
                    );
                })}
            </div>

            {reg.status !== "cancelled" && (
                <div className="mt-3 flex items-center gap-2">
                    <button
                        onClick={() => onCancel(reg._id)}
                        disabled={cancelling === reg._id}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <IconX size={11} />
                        {cancelling === reg._id ? "Cancelling…" : "Cancel Registration"}
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RegistrationsPage() {
    const [statusTab, setStatusTab] = useState<StatusTab>("all");
    const [paymentStatus, setPaymentStatus] = useState("all");
    const [eventFilter, setEventFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [page, setPage] = useState(1);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState<string | null>(null);
    const [checkingIn, setCheckingIn] = useState<string | null>(null);

    const [eventsList, setEventsList] = useState<{ _id: string; title: string }[]>([]);
    const [customFormFields, setCustomFormFields] = useState<IFormField[]>([]);
    const [selectedEventDetails, setSelectedEventDetails] = useState<any>(null);
    const [showSheetModal, setShowSheetModal] = useState(false);
    const [sheetData, setSheetData] = useState<any[]>([]);
    const [sheetLoading, setSheetLoading] = useState(false);

    // Load events list on mount
    useEffect(() => {
        getManagementEventsList().then((res) => {
            if (res.success) setEventsList(res.data as any[]);
        });
    }, []);

    // When event filter changes, load customForm for that event
    useEffect(() => {
        if (eventFilter === "all") {
            setCustomFormFields([]);
            setSelectedEventDetails(null);
            return;
        }
        getEventWithCustomForm(eventFilter).then((res) => {
            if (res.success && res.data) {
                const ev = res.data as any;
                setCustomFormFields(ev.customForm ?? []);
                setSelectedEventDetails(ev);
            }
        });
    }, [eventFilter]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getAllRegistrationsAdmin({
                page,
                limit: 50,
                status: statusTab === "all" ? undefined : statusTab,
                paymentStatus: paymentStatus === "all" ? undefined : paymentStatus,
                search: search || undefined,
                eventId: eventFilter === "all" ? undefined : eventFilter,
            });
            if (result.success) {
                setData(result.data as any[]);
                setTotal(result.total);
                setTotalPages(result.totalPages);
            }
        } finally {
            setLoading(false);
        }
    }, [page, statusTab, paymentStatus, search, eventFilter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => { setPage(1); }, [statusTab, paymentStatus, search, eventFilter]);

    function toggleRow(id: string) {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    async function handleCancel(id: string) {
        if (!confirm("Cancel this registration? This cannot be undone.")) return;
        setCancelling(id);
        try {
            const result = await cancelRegistrationAdmin(id);
            if (result.success) {
                setData((prev) => prev.map((r) => r._id === id ? { ...r, status: "cancelled" } : r));
            } else {
                alert(result.error ?? "Failed to cancel.");
            }
        } finally {
            setCancelling(null);
        }
    }

    async function handleCheckIn(ticketId: string, regId: string) {
        setCheckingIn(ticketId);
        try {
            const result = await checkInTicketAdmin(ticketId);
            if (result.success) {
                const updated = result.data as any;
                setData((prev) => prev.map((r) => r._id === regId ? {
                    ...r,
                    tickets: r.tickets.map((t: any) => t._id === ticketId ? {
                        ...t,
                        attendanceStatus: updated.attendanceStatus,
                        checkedInAt: updated.checkedInAt,
                    } : t),
                } : r));
            } else {
                alert((result as any).error ?? "Failed to update check-in.");
            }
        } finally {
            setCheckingIn(null);
        }
    }

    async function handleOpenSheetModal() {
        if (eventFilter === "all" || !selectedEventDetails) return;
        setSheetLoading(true);
        try {
            const result = await getAllRegistrationsForEvent(eventFilter);
            if (result.success) {
                setSheetData(result.data as any[]);
                setShowSheetModal(true);
            }
        } finally {
            setSheetLoading(false);
        }
    }

    function handleSearchSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSearch(searchInput);
    }

    return (
        <>
            {showSheetModal && (
                <DownloadSheetModal
                    onClose={() => setShowSheetModal(false)}
                    sheetData={sheetData}
                    customFormFields={customFormFields}
                    eventDetails={selectedEventDetails}
                />
            )}

            <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900">Registrations</h1>
                        <p className="text-sm text-zinc-500 mt-0.5">
                            {loading ? "Loading…" : `${total.toLocaleString()} registration${total !== 1 ? "s" : ""}`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleOpenSheetModal}
                            disabled={eventFilter === "all" || sheetLoading}
                            title={eventFilter === "all" ? "Select an event to download sheet" : undefined}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {sheetLoading ? <IconLoader2 size={15} className="animate-spin" /> : <IconPrinter size={15} />}
                            Download Sheet
                        </button>
                        <button
                            onClick={() => downloadCSV(data)}
                            disabled={data.length === 0}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <IconDownload size={15} />
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex gap-1 bg-zinc-100 p-1 rounded-lg self-start">
                        {STATUS_TABS.map((s) => (
                            <button
                                key={s}
                                onClick={() => setStatusTab(s)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${
                                    statusTab === s
                                        ? "bg-white text-zinc-900 shadow-sm"
                                        : "text-zinc-500 hover:text-zinc-700"
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2 flex-1 flex-wrap">
                        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                            <SelectTrigger className="w-40 h-9 text-sm bg-white">
                                <IconFilter size={14} className="text-zinc-400 mr-1" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PAYMENT_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={eventFilter} onValueChange={setEventFilter}>
                            <SelectTrigger className="w-52 h-9 text-sm bg-white">
                                <SelectValue placeholder="All Events" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Events</SelectItem>
                                {eventsList.map((ev) => (
                                    <SelectItem key={ev._id} value={ev._id}>{ev.title}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2 min-w-0">
                            <div className="relative flex-1 min-w-0">
                                <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                <input
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    placeholder="Search by name, email, or USN…"
                                    className="w-full pl-8 pr-3 h-9 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                                />
                            </div>
                            <button
                                type="submit"
                                className="px-3 h-9 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                            >
                                Search
                            </button>
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => { setSearch(""); setSearchInput(""); }}
                                    className="px-3 h-9 text-sm font-medium bg-zinc-100 text-zinc-600 rounded-lg hover:bg-zinc-200"
                                >
                                    Clear
                                </button>
                            )}
                        </form>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-zinc-200">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 text-zinc-400">
                            <IconLoader2 size={20} className="animate-spin mr-2" />
                            Loading…
                        </div>
                    ) : data.length === 0 ? (
                        <div className="py-20 text-center text-sm text-zinc-400">No registrations found.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-100 bg-zinc-50/50">
                                        <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Participant</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Event</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Type</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Check-in</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Payment</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Transaction ID</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Registered</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((reg: any) => {
                                        const isExpanded = expandedRows.has(reg._id);
                                        const ticketCount = reg.tickets?.length ?? 0;
                                        return (
                                            <Fragment key={reg._id}>
                                                <tr
                                                    className={`border-t border-zinc-100 hover:bg-zinc-50 transition-colors cursor-pointer ${isExpanded ? "bg-zinc-50/50" : ""}`}
                                                    onClick={() => toggleRow(reg._id)}
                                                >
                                                    <td className="px-5 py-3.5">
                                                        <p className="font-medium text-zinc-900">{reg.userId?.name ?? "—"}</p>
                                                        <p className="text-xs text-zinc-400">{reg.userId?.email ?? "—"}</p>
                                                        {reg.userId?.collegeId && (
                                                            <p className="text-xs text-zinc-400 font-mono">{reg.userId.collegeId}</p>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-zinc-600 max-w-44">
                                                        {reg.eventId?._id ? (
                                                            <a
                                                                href={`/manage/events/${reg.eventId._id}`}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="hover:text-orange-600 hover:underline line-clamp-2"
                                                            >
                                                                {reg.eventId.title}
                                                            </a>
                                                        ) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-xs text-zinc-500 whitespace-nowrap">
                                                        {reg.isTeamRegistration ? (
                                                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">Team</span>
                                                        ) : (
                                                            <span className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-medium">Individual</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3.5">{statusBadge(reg.status)}</td>
                                                    <td className="px-4 py-3.5">
                                                        {(() => {
                                                            const tickets: any[] = reg.tickets ?? [];
                                                            const total = tickets.length;
                                                            if (total === 0) return <span className="text-xs text-zinc-300">—</span>;
                                                            const checked = tickets.filter((t: any) => t.attendanceStatus).length;
                                                            if (checked === 0) return <span className="text-xs text-zinc-400">0/{total}</span>;
                                                            if (checked === total) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">{checked}/{total}</span>;
                                                            return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{checked}/{total}</span>;
                                                        })()}
                                                    </td>
                                                    <td className="px-4 py-3.5">{paymentBadge(reg.paymentStatus)}</td>
                                                    <td className="px-4 py-3.5 text-xs text-zinc-500 font-mono">
                                                        {reg.paymentId ?? "—"}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-xs text-zinc-400 whitespace-nowrap">
                                                        {new Date(reg.createdAt).toLocaleDateString("en-IN", {
                                                            day: "numeric", month: "short", year: "numeric",
                                                        })}
                                                        <br />
                                                        <span className="text-zinc-300">
                                                            {new Date(reg.createdAt).toLocaleTimeString("en-IN", {
                                                                hour: "2-digit", minute: "2-digit",
                                                            })}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {ticketCount > 0 && (
                                                                <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                                                                    <IconTicket size={11} />{ticketCount}
                                                                </span>
                                                            )}
                                                            <IconChevronDown
                                                                size={15}
                                                                className={`text-zinc-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="border-t border-zinc-100 bg-zinc-50/30">
                                                        <td colSpan={9} className="p-0">
                                                            <TicketAccordion
                                                                reg={reg}
                                                                onCancel={handleCancel}
                                                                cancelling={cancelling}
                                                                onCheckIn={handleCheckIn}
                                                                checkingIn={checkingIn}
                                                            />
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100">
                            <p className="text-xs text-zinc-400">
                                Page {page} of {totalPages} — {total.toLocaleString()} total
                            </p>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1 || loading}
                                    className="p-1.5 rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <IconChevronLeft size={14} />
                                </button>
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages || loading}
                                    className="p-1.5 rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <IconChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
