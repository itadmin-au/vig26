import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event, Registration } from "@/models";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import fs from "fs";
import path from "path";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isAtria(usn: string | null | undefined): boolean {
    if (!usn) return false;
    return usn.trim().toUpperCase().startsWith("1AT");
}

function extractCollegeCode(usn: string | null | undefined): string | null {
    if (!usn) return null;
    const m = usn.trim().toUpperCase().match(/^1([A-Z]{2})\d{2}/);
    return m ? m[1] : null;
}

const COLLEGE_MAP: Record<string, string> = {
    AT: "Atria Institute of Technology",
    MS: "M. S. Ramaiah Institute of Technology",
    RV: "RV College of Engineering",
    BM: "BMS College of Engineering",
    DS: "Dayananda Sagar College of Engineering",
    PE: "PES University",
    BN: "BNM Institute of Technology",
    NM: "Nitte Meenakshi Institute of Technology",
    JS: "JSS Academy of Technical Education",
    SJ: "SJB Institute of Technology",
    CM: "CMR Institute of Technology",
    GL: "Global Academy of Technology",
    JY: "Jyothy Institute of Technology",
    AC: "Acharya Institute of Technology",
    SB: "Sir M. Visvesvaraya IT",
    VE: "Vemana Institute of Technology",
    NA: "New Horizon College of Engineering",
    BA: "Bangalore Institute of Technology",
    ST: "Sapthagiri College of Engineering",
    AM: "AMC Engineering College",
    HK: "Nitte Institute of Technology",
    SV: "Sri Venkateshwara College of Engineering",
    AJ: "AJ Institute of Engineering and Technology",
    CB: "Canara Engineering College",
    BE: "Bearys Institute of Technology",
    VK: "Vidya Vikas Institute of Engineering and Technology",
    SD: "SDM College of Engineering and Technology",
    AX: "Alva's Institute of Engineering and Technology",
    PN: "Presidency University",
    RI: "Reva University",
    CK: "CHRIST (Deemed to be University)",
};

  const COLLEGE_LOCATION_MAP: Record<string, { city: string; state: string }> = {
    AT: { city: "Bengaluru", state: "Karnataka" },
    MS: { city: "Bengaluru", state: "Karnataka" },
    RV: { city: "Bengaluru", state: "Karnataka" },
    BM: { city: "Bengaluru", state: "Karnataka" },
    DS: { city: "Bengaluru", state: "Karnataka" },
    PE: { city: "Bengaluru", state: "Karnataka" },
    BN: { city: "Bengaluru", state: "Karnataka" },
    NM: { city: "Bengaluru", state: "Karnataka" },
    JS: { city: "Bengaluru", state: "Karnataka" },
    SJ: { city: "Bengaluru", state: "Karnataka" },
    CM: { city: "Bengaluru", state: "Karnataka" },
    GL: { city: "Bengaluru", state: "Karnataka" },
    JY: { city: "Bengaluru", state: "Karnataka" },
    AC: { city: "Bengaluru", state: "Karnataka" },
    SB: { city: "Bengaluru", state: "Karnataka" },
    VE: { city: "Bengaluru", state: "Karnataka" },
    NA: { city: "Bengaluru", state: "Karnataka" },
    BA: { city: "Bengaluru", state: "Karnataka" },
    ST: { city: "Bengaluru", state: "Karnataka" },
    AM: { city: "Bengaluru", state: "Karnataka" },
    HK: { city: "Karkala", state: "Karnataka" },
    SV: { city: "Bengaluru", state: "Karnataka" },
    AJ: { city: "Mangaluru", state: "Karnataka" },
    CB: { city: "Mangaluru", state: "Karnataka" },
    BE: { city: "Mangaluru", state: "Karnataka" },
    VK: { city: "Mysuru", state: "Karnataka" },
    SD: { city: "Dharwad", state: "Karnataka" },
    AX: { city: "Moodbidri", state: "Karnataka" },
    PN: { city: "Bengaluru", state: "Karnataka" },
    RI: { city: "Bengaluru", state: "Karnataka" },
    CK: { city: "Bengaluru", state: "Karnataka" },
  };

// ─── GET /api/report ─────────────────────────────────────────────────────────

export async function GET(request: Request) {
    try {
        await requireSuperAdmin();
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get("type");
    const categoryFilter = searchParams.get("category");

    const eventQuery: Record<string, unknown> = { status: "published" };
    if (typeFilter) eventQuery.type = typeFilter;
    if (categoryFilter) eventQuery.category = categoryFilter;

    const events = await Event.find(eventQuery)
        .populate("department", "name")
        .lean() as any[];

    const registrations = await Registration.find({ status: { $ne: "cancelled" } })
        .populate("userId", "name email collegeId")
        .sort({ createdAt: -1 })
        .lean() as any[];

    // Group by event
    const regsByEvent: Record<string, any[]> = {};
    for (const r of registrations) {
        const eid = r.eventId.toString();
        (regsByEvent[eid] ??= []).push(r);
    }

    // Per-event stats
    const eventStats = events.map(ev => {
        const regs = regsByEvent[ev._id.toString()] ?? [];
        let revenue = 0;
        let atriaRegs = 0;
        let participants = 0;
        const collegeCount: Record<string, number> = {};

        for (const r of regs) {
            // Only count completed payments for revenue
            if (r.paymentStatus === "completed") revenue += r.amountPaid ?? 0;
            participants += 1 + (r.teamMembers?.length ?? 0);
            const usn = r.userId?.collegeId ?? null;
            if (isAtria(usn)) {
                atriaRegs++;
            } else {
                const code = extractCollegeCode(usn);
                if (code) collegeCount[code] = (collegeCount[code] ?? 0) + 1;
            }
        }

        return {
            id: ev._id.toString(),
            title: ev.title,
            category: ev.category ? (ev.category.charAt(0).toUpperCase() + ev.category.slice(1)) : "Other",
            type: ev.type,
            price: ev.price ?? 0,
            registrations: regs.length,
            participants,
            revenue,
            atriaRegs,
            externalRegs: regs.length - atriaRegs,
            collegeCount,
        };
    });

    eventStats.sort((a, b) => b.revenue - a.revenue || b.registrations - a.registrations);

    const totalRevenue = eventStats.reduce((s, e) => s + e.revenue, 0);
    const totalRegistrations = eventStats.reduce((s, e) => s + e.registrations, 0);
    const totalParticipants = eventStats.reduce((s, e) => s + e.participants, 0);
    const totalAtria = eventStats.reduce((s, e) => s + e.atriaRegs, 0);
    const totalExternal = eventStats.reduce((s, e) => s + e.externalRegs, 0);

    // Overall college breakdown (excluding Atria)
    const overallColleges: Record<string, number> = {};
    for (const e of eventStats) {
        for (const [code, n] of Object.entries(e.collegeCount)) {
            overallColleges[code] = (overallColleges[code] ?? 0) + n;
        }
    }
    const registeredCollegeCodes = new Set<string>(["AT", ...Object.keys(overallColleges)]);
    const registeredCities = new Set<string>();
    const registeredStates = new Set<string>();
    for (const code of registeredCollegeCodes) {
      const location = COLLEGE_LOCATION_MAP[code];
      if (!location) continue;
      registeredCities.add(location.city);
      registeredStates.add(location.state);
    }
    const topExternal = Object.entries(overallColleges)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([code, regs]) => ({
            code,
            name: COLLEGE_MAP[code] ?? `Code ${code}`,
            regs,
            raw: !COLLEGE_MAP[code],
        }));

    // Latest 10 registrations
    const latest = registrations.slice(0, 10).map(r => {
        const usn = r.userId?.collegeId ?? null;
        const code = extractCollegeCode(usn);
        const college =
            isAtria(usn) ? "Atria IT"
            : code ? (COLLEGE_MAP[code] ?? code)
            : "—";
        const regId = r._id.toString();
        const ev = events.find(e => e._id.toString() === r.eventId.toString());
        const dateStr = new Date(r.createdAt).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", timeZone: "Asia/Kolkata",
        }) + " · " + new Date(r.createdAt).toLocaleTimeString("en-IN", {
            hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata", hour12: false,
        });
        const statusMap: Record<string, string> = {
            confirmed: "Confirmed",
            pending: "Pending",
            cancelled: "Cancelled",
        };
        return {
            id: regId,
            event: ev?.title ? (ev.title.length > 28 ? ev.title.slice(0, 27) + "…" : ev.title) : "—",
            usn: usn ?? "—",
            college,
            date: dateStr,
            amount: r.amountPaid ?? 0,
            status: statusMap[r.status] ?? r.status,
        };
    });

    const genDate = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata", month: "long", day: "numeric",
        year: "numeric", hour: "2-digit", minute: "2-digit",
    }) + " IST";

    const reportData = {
        generatedAt: genDate,
        fest: {
            name: "Vigyaanrang 2026",
            edition: "",
            host: "Atria Institute of Technology",
            window: "APRIL 21 – APRIL 25, 2026",
        },
        totals: {
            revenue: totalRevenue,
            revenueDelta: 0,
            registrations: totalRegistrations,
            participants: totalParticipants,
            registrationsDelta: 0,
            events: eventStats.length,
            eventsDelta: 0,
            atria: totalAtria,
            external: totalExternal,
        },
          geography: {
            colleges: registeredCollegeCodes.size,
            cities: registeredCities.size,
            states: registeredStates.size,
          },
        events: eventStats.map(e => ({
            id: e.id,
            name: e.title,
            category: e.category,
            regs: e.registrations,
            fee: e.price,
            revenue: e.revenue,
        })),
        eventSplit: Object.fromEntries(eventStats.map(e => [e.id, e.atriaRegs])),
        topExternal,
        latest,
    };

    // Read logos
    const root = process.cwd();
    let atriaB64 = "";
    let vigB64 = "";
    try {
        atriaB64 = fs.readFileSync(path.join(root, "public", "atria-logo.png")).toString("base64");
    } catch { /* no logo, header will still show text */ }
    try {
        vigB64 = fs.readFileSync(path.join(root, "public", "vigyaanrang.png")).toString("base64");
    } catch { /* no logo */ }

    const html = buildHTML(reportData, atriaB64, vigB64);
    const filename = `vigyaanrang-2026-analytics-${new Date().toISOString().split("T")[0]}.html`;

    return new NextResponse(html, {
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    });
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildHTML(reportData: object, atriaB64: string, vigB64: string): string {
    const dataJSON = JSON.stringify(reportData);
    const atriaSrc = atriaB64 ? `data:image/png;base64,${atriaB64}` : "";
    const vigSrc = vigB64 ? `data:image/png;base64,${vigB64}` : "";

    // NOTE: JSX uses {expr} (no $), which is safe inside TypeScript template literals
    // that only interpolate ${expr}. So the component code below is literal text.
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Vigyaanrang 2026 — Analytics Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --ink: #000000;
      --paper: #FFFFFF;
      --g-50: #F5F5F5;
      --g-200: #E5E5E5;
      --g-400: #A3A3A3;
      --g-600: #525252;
    }
    html, body {
      background: #EDEDEB;
      font-family: 'Inter', system-ui, sans-serif;
      color: var(--ink);
      -webkit-font-smoothing: antialiased;
      font-feature-settings: "ss01", "cv11";
    }
    .num {
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum" 1, "ss01" 1;
    }
    .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
    .sheet {
      width: 820px;
      background: #fff;
      margin: 32px auto;
      padding: 56px 56px 72px;
      box-shadow: 0 1px 0 rgba(0,0,0,0.04), 0 24px 60px -20px rgba(0,0,0,0.18);
      border: 1px solid #E5E5E5;
    }
    .rule { border-top: 1px solid #000; }
    .hair { border-top: 1px solid #E5E5E5; }
    .dashed { border-top: 1px dashed #E5E5E5; }
    .section { break-inside: auto; page-break-inside: auto; }
    .section-head { break-after: avoid; page-break-after: avoid; }
    .toolbar {
      position: fixed; top: 16px; right: 16px; z-index: 50; display: flex; gap: 8px;
    }
    .btn {
      background: #000; color: #fff; font-size: 12px; letter-spacing: 0.04em;
      text-transform: uppercase; padding: 10px 14px; border-radius: 8px; font-weight: 600;
      cursor: pointer; border: none;
    }
    .btn.ghost {
      background: #fff; color: #000; border: 1px solid #E5E5E5;
    }
    .btn:hover { opacity: 0.9; }
    .card { border: 1px solid #E5E5E5; border-radius: 14px; background: #fff; }
    .card-ink { background: #000; color: #fff; border-radius: 14px; }
    .pill {
      display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px;
      border-radius: 999px; font-size: 11px; letter-spacing: 0.02em; font-weight: 500;
      line-height: 1.2; white-space: nowrap;
    }
    .pill-confirmed { border: 1px solid #000; color: #000; }
    .pill-pending   { border: 1px solid #A3A3A3; color: #525252; }
    .pill-refunded  { border: 1px dashed #525252; color: #525252; }
    .dot     { width: 6px; height: 6px; background: #000; border-radius: 999px; display: inline-block; }
    .dot-out { width: 6px; height: 6px; border: 1px solid #000; border-radius: 999px; display: inline-block; }
    .track { background: #F5F5F5; height: 6px; border-radius: 999px; overflow: hidden; }
    .track > span { display: block; height: 100%; background: #000; border-radius: 999px; }
    .eyebrow {
      font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: #525252; font-weight: 600;
    }
    .kpi    { font-size: 30px; line-height: 1; font-weight: 700; letter-spacing: -0.02em; }
    .kpi-sm { font-size: 22px; line-height: 1; font-weight: 700; letter-spacing: -0.02em; }
    @page { size: A4; margin: 14mm; }
    @media print {
      html, body { background: #fff !important; }
      .toolbar, .no-print { display: none !important; }
      .sheet { width: auto; margin: 0; padding: 0; box-shadow: none; border: 0; }
      .section { break-inside: auto; page-break-inside: auto; }
      .section-head { break-after: avoid; page-break-after: avoid; }
      .card, .card-ink { break-inside: avoid; page-break-inside: avoid; }
      .card-large { break-inside: auto !important; page-break-inside: auto !important; }
      .row-item { break-inside: avoid; page-break-inside: avoid; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .card-ink { background: #000 !important; color: #fff !important; }
      .track { background: #F5F5F5 !important; }
      .track > span { background: #000 !important; }
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    window.__resources = {
      atriaLogo: "${atriaSrc}",
      vigyanrangLogo: "${vigSrc}"
    };
    const reportData = ${dataJSON};
  </script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script type="text/babel">
/* global React, ReactDOM */
const { useMemo } = React;

const inr = (n) =>
  "\\u20b9" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
const inrCompact = (n) => {
  if (n >= 100000) return "\\u20b9" + (n / 100000).toFixed(2) + " L";
  if (n >= 1000)   return "\\u20b9" + (n / 1000).toFixed(1) + "K";
  return "\\u20b9" + n;
};
const pct = (n) => (n > 0 ? "+" : "") + n.toFixed(1) + "%";

function Eyebrow({ children, className = "" }) {
  return <div className={"eyebrow " + className}>{children}</div>;
}

function Delta({ value, invert = false }) {
  if (value === 0) {
    return (
      <span className={"mono text-[11px] " + (invert ? "text-white/60" : "text-[#525252]")}>
        ±0.0%
      </span>
    );
  }
  const up = value > 0;
  return (
    <span className={"mono text-[11px] inline-flex items-center gap-1 " + (invert ? "text-white/80" : "text-[#525252]")}>
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      <span className="num">{pct(value)}</span>
    </span>
  );
}

function SectionHead({ no, title, kicker, children }) {
  return (
    <div className="section-head mb-5 flex items-end justify-between gap-6">
      <div>
        <Eyebrow className="mb-2">Section {no}</Eyebrow>
        <h2 className="text-[22px] font-semibold tracking-tight leading-tight">{title}</h2>
        {kicker ? (
          <p className="text-[12.5px] text-[#525252] mt-1.5 max-w-[60ch] leading-snug">{kicker}</p>
        ) : null}
      </div>
      {children ? <div className="text-right">{children}</div> : null}
    </div>
  );
}

function Header({ data }) {
  return (
    <header className="section">
      <div className="flex items-center justify-between text-[10px] mono tracking-[0.16em] uppercase text-[#525252]">
        <span>Vigyaanrang 2026 · Analytics Report</span>
        <span>Page <span className="num">1</span> of <span className="num">1</span></span>
      </div>
      <div className="hair mt-2" />

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 mt-6">
        <div className="flex items-center">
          {window.__resources.atriaLogo ? (
            <img src={window.__resources.atriaLogo} alt="Atria Institute of Technology" className="h-14.5 w-auto" />
          ) : (
            <div className="text-[13px] font-semibold text-[#525252]">Atria Institute of Technology</div>
          )}
        </div>

        <div className="text-center px-2">
          <div className="mono text-[10px] tracking-[0.32em] uppercase text-[#525252]">
            Inter-college Tech Fest
          </div>
          <h1 className="text-[34px] font-extrabold tracking-tight leading-[1.05] mt-1">
            Vigyaanrang <span className="num">2026</span>
          </h1>
          <div className="mono text-[10px] tracking-[0.18em] uppercase text-[#525252] mt-1">
            Analytics Report
          </div>
        </div>

        <div className="flex items-center justify-end">
          {window.__resources.vigyanrangLogo ? (
            <img src={window.__resources.vigyanrangLogo} alt="Vigyaanrang" className="h-14.5 w-auto" style={{filter: "brightness(0)"}} />
          ) : (
            <div className="text-[13px] font-semibold text-[#525252]">Vigyaanrang 2026</div>
          )}
        </div>
      </div>

      <div className="rule mt-6" />
      <div className="flex items-center justify-between mt-2.5 text-[11px] text-[#525252]">
        <span>
          <span className="mono uppercase tracking-[0.14em] text-[#A3A3A3] mr-2">Host</span>
          {data.fest.host}
        </span>
        <span>
          <span className="mono uppercase tracking-[0.14em] text-[#A3A3A3] mr-2">Fest window</span>
          <span className="num">{data.fest.window}</span>
        </span>
        <span>
          <span className="mono uppercase tracking-[0.14em] text-[#A3A3A3] mr-2">Generated</span>
          <span className="num">{data.generatedAt}</span>
        </span>
      </div>
      <div className="hair mt-2.5" />
    </header>
  );
}

function StatRow({ label, value, delta, meta }) {
  return (
    <div className="card px-5 py-3.5 flex items-center justify-between gap-5">
      <div className="flex-1 min-w-0">
        <Eyebrow className="leading-none">{label}</Eyebrow>
        <div className="text-[11px] text-[#525252] mt-1.5 leading-snug truncate">{meta}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[28px] leading-none font-bold tracking-tight num">{value}</div>
        {delta !== undefined ? (
          <div className="mt-1.5"><Delta value={delta} /></div>
        ) : null}
      </div>
    </div>
  );
}

function KpiRow({ data }) {
  const t = data.totals;
  const atriaPct = t.atria + t.external > 0
    ? (t.atria / (t.atria + t.external)) * 100
    : 0;
  const extPct = 100 - atriaPct;

  return (
    <section className="section mt-8 grid grid-cols-12 gap-4">
      <div className="card-ink p-6 flex flex-col justify-between min-h-44 col-span-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Eyebrow className="text-white/60!">Total Revenue</Eyebrow>
            <div className="mono text-[10px] tracking-[0.14em] uppercase text-white/50 mt-1">
              Gross · INR · FY 25–26
            </div>
          </div>
        </div>
        <div>
          <div className="text-[52px] leading-none font-bold tracking-tight num">{inr(t.revenue)}</div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-white/60">
            <span>Σ across <span className="num">{t.events}</span> events</span>
            <span className="mono">avg <span className="num">{t.registrations > 0 ? inr(Math.round(t.revenue / t.registrations)) : "₹0"}</span> / regn</span>
          </div>
        </div>
      </div>

      <div className="col-span-7 grid grid-rows-3 gap-3">
        <StatRow
          label="Total Participants"
          value={t.participants.toLocaleString("en-IN")}
          delta={t.registrationsDelta}
          meta={t.registrations.toLocaleString("en-IN") + " registrations · " + t.events + " events"}
        />
        <StatRow
          label="Total Events"
          value={t.events}
          delta={t.eventsDelta}
          meta="Tech · Cultural · Hackathon"
        />
        <StatRow
          label="Atria vs External"
          value={
            <span className="flex items-baseline gap-3">
              <span className="num">{t.atria}</span>
              <span className="text-[#A3A3A3] text-[18px] font-normal">/</span>
              <span className="num text-[#525252]">{t.external}</span>
            </span>
          }
          meta={
            <span className="flex items-center gap-3">
              <span className="num">Atria {atriaPct.toFixed(1)}%</span>
              <span className="flex-1 track max-w-30"><span style={{width: atriaPct + "%"}} /></span>
              <span className="num text-[#A3A3A3]">External {extPct.toFixed(1)}%</span>
            </span>
          }
        />
      </div>
    </section>
  );
}

function GeoRow({ data }) {
  const g = data.geography;

  return (
    <section className="section mt-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="card px-5 py-3.5">
          <Eyebrow>Total Colleges</Eyebrow>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div className="text-[28px] leading-none font-bold tracking-tight num">{g.colleges}</div>
            <div className="text-[11px] text-[#525252] text-right leading-snug">
              Unique institutions registered
            </div>
          </div>
        </div>
        <div className="card px-5 py-3.5">
          <Eyebrow>Cities</Eyebrow>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div className="text-[28px] leading-none font-bold tracking-tight num">{g.cities}</div>
            <div className="text-[11px] text-[#525252] text-right leading-snug">
              Distinct city locations
            </div>
          </div>
        </div>
        <div className="card px-5 py-3.5">
          <Eyebrow>States</Eyebrow>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div className="text-[28px] leading-none font-bold tracking-tight num">{g.states}</div>
            <div className="text-[11px] text-[#525252] text-right leading-snug">
              Distinct state locations
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RevenueByEvent({ data }) {
  const rows = useMemo(() => {
    return data.events
      .map((e) => ({ ...e, revenue: e.revenue != null ? e.revenue : e.regs * e.fee }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [data]);
  const max = rows.length > 0 ? rows[0].revenue : 1;
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalRegs = rows.reduce((s, r) => s + r.regs, 0);

  return (
    <section className="section mt-12">
      <SectionHead
        no="01"
        title="Revenue by Event"
        kicker="Sorted by gross revenue. Bar length is proportional to the top event."
      >
        <div className="mono text-[11px] text-[#525252]">
          Σ&nbsp;<span className="num">{inr(totalRevenue)}</span>
        </div>
      </SectionHead>

      <div className="card card-large overflow-hidden">
        <div className="grid grid-cols-[28px_1fr_56px_96px_76px] gap-3 px-5 py-2.5 bg-[#FAFAFA] border-b border-[#E5E5E5]">
          <div />
          <div className="eyebrow">Event</div>
          <div className="eyebrow text-right">Regs</div>
          <div className="eyebrow text-right">Revenue</div>
          <div className="eyebrow text-right">Base Fee</div>
        </div>

        <div className="divide-y divide-dashed divide-[#E5E5E5] px-5">
          {rows.map((r, i) => {
            const w = max > 0 ? (r.revenue / max) * 100 : 0;
            return (
              <div key={r.id} className="row-item grid grid-cols-[28px_1fr_56px_96px_76px] items-center gap-3 py-3">
                <div className="mono text-[11px] text-[#A3A3A3] num self-start pt-0.5">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[12.5px] font-medium leading-none">{r.name}</span>
                    <span className="text-[10px] text-[#A3A3A3] mono uppercase tracking-widest ml-2 shrink-0">{r.category}</span>
                  </div>
                  <div className="relative h-2.5 bg-[#F5F5F5] rounded-[3px] overflow-hidden">
                    <div className="h-full bg-black" style={{width: w + "%"}} />
                  </div>
                </div>
                <div className="text-right num text-[12px] text-[#525252]">{r.regs}</div>
                <div className="text-right num text-[12.5px] font-semibold">{r.revenue > 0 ? inr(r.revenue) : "—"}</div>
                <div className="text-right num text-[12px] text-[#525252]">{r.fee > 0 ? inr(r.fee) : "Free"}</div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-[28px_1fr_56px_96px_76px] gap-3 px-5 py-2 border-t border-dashed border-[#E5E5E5]">
          <div />
          <div className="grid grid-cols-5 text-[10px] mono text-[#A3A3A3] num">
            {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
              <div key={i} className={i === 0 ? "text-left" : i === 4 ? "text-right" : "text-center"}>
                {inrCompact(Math.round(max * p))}
              </div>
            ))}
          </div>
          <div /><div /><div />
        </div>

        <div className="grid grid-cols-[28px_1fr_56px_96px_76px] items-center gap-3 px-5 py-3 border-t border-black bg-[#FAFAFA]">
          <div />
          <div className="text-[12.5px] font-semibold">Total</div>
          <div className="text-right num text-[12.5px] font-semibold">{totalRegs}</div>
          <div className="text-right num text-[12.5px] font-semibold">{inr(totalRevenue)}</div>
          <div className="text-right num text-[12px] text-[#525252]">—</div>
        </div>
      </div>
    </section>
  );
}

function AtriaVsExternal({ data }) {
  const rows = useMemo(() => {
    return data.events.map((e) => {
      const atria = data.eventSplit[e.id] || 0;
      const external = e.regs - atria;
      return { ...e, atria, external, total: e.regs, atriaPct: e.regs > 0 ? (atria / e.regs) * 100 : 0 };
    });
  }, [data]);

  const totalAtria = rows.reduce((s, r) => s + r.atria, 0);
  const totalExt = rows.reduce((s, r) => s + r.external, 0);

  return (
    <section className="section mt-12">
      <SectionHead
        no="02"
        title="Registration Distribution"
        kicker='Atria vs Other Colleges, classified by USN prefix. A registrant whose USN begins with "1AT…" is counted as Atria; everything else is external.'
      >
        <div className="mono text-[11px] text-[#525252] space-y-0.5">
          <div><span className="dot mr-1.5 align-middle" />Atria · <span className="num">{totalAtria}</span></div>
          <div><span className="dot-out mr-1.5 align-middle" />External · <span className="num">{totalExt}</span></div>
        </div>
      </SectionHead>

      <div className="card card-large overflow-hidden">
        <div className="grid grid-cols-[1fr_64px_72px_56px_60px] gap-3 px-5 py-2.5 bg-[#FAFAFA] border-b border-[#E5E5E5]">
          <div className="eyebrow">Event</div>
          <div className="eyebrow text-right">Atria</div>
          <div className="eyebrow text-right">External</div>
          <div className="eyebrow text-right">Total</div>
          <div className="eyebrow text-right">Atria %</div>
        </div>

        <div className="divide-y divide-dashed divide-[#E5E5E5] px-5">
          {rows.map((r) => {
            const pctA = r.atriaPct;
            return (
              <div key={r.id} className="row-item grid grid-cols-[1fr_64px_72px_56px_60px] items-center gap-3 py-3">
                <div>
                  <div className="text-[12.5px] font-medium leading-none mb-1.5">{r.name}</div>
                  <div className="track">
                    <span style={{width: pctA + "%"}} />
                  </div>
                </div>
                <div className="text-right num text-[12px]">{r.atria}</div>
                <div className="text-right num text-[12px] text-[#525252]">{r.external}</div>
                <div className="text-right num text-[12px] font-semibold">{r.total}</div>
                <div className="text-right num text-[12px]">{pctA.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-[1fr_64px_72px_56px_60px] items-center gap-3 px-5 py-3 border-t border-black bg-[#FAFAFA]">
          <div className="text-[12.5px] font-semibold">Total</div>
          <div className="text-right num text-[12.5px] font-semibold">{totalAtria}</div>
          <div className="text-right num text-[12.5px] font-semibold">{totalExt}</div>
          <div className="text-right num text-[12.5px] font-semibold">{totalAtria + totalExt}</div>
          <div className="text-right num text-[12px] font-semibold">
            {(totalAtria + totalExt) > 0
              ? ((totalAtria / (totalAtria + totalExt)) * 100).toFixed(1) + "%"
              : "—"}
          </div>
        </div>
      </div>
    </section>
  );
}

function TopExternal({ data }) {
  const rows = data.topExternal;
  if (!rows || rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.regs));

  return (
    <section className="section mt-12">
      <SectionHead
        no="03"
        title="Top External Colleges"
        kicker='Resolved by USN positions 2–3 (e.g. "1MS22…" → MSRIT). Codes that do not map to a known institution are shown as-is.'
      >
        <div className="mono text-[11px] text-[#525252]">
          Top <span className="num">{rows.length}</span> · external pool
        </div>
      </SectionHead>

      <div className="card p-5">
        <ol className="space-y-3.5">
          {rows.map((r, i) => {
            const w = max > 0 ? (r.regs / max) * 100 : 0;
            return (
              <li key={r.code + i} className="grid grid-cols-[28px_1fr_56px] items-center gap-3">
                <span className="mono text-[11px] text-[#A3A3A3] num">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={"text-[12.5px] leading-none " + (r.raw ? "text-[#525252] italic" : "font-medium")}>
                      {r.name}
                    </span>
                    <span className="mono text-[10px] text-[#A3A3A3] uppercase tracking-widest">
                      {r.raw ? "raw" : ("1" + r.code + "…")}
                    </span>
                  </div>
                  <div className="track mt-1.5">
                    <span style={{width: w + "%"}} />
                  </div>
                </div>
                <span className="text-right num text-[13px] font-semibold">{r.regs}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}


function Footer({ data }) {
  return (
    <footer className="section mt-12">
      <div className="rule" />
      <div className="flex items-center justify-between mt-3">
        <div className="mono text-[10px] text-[#A3A3A3] tracking-[0.14em] uppercase">
          Generated <span className="num">{data.generatedAt}</span>
        </div>
        <div className="text-[10px] text-[#525252] uppercase tracking-[0.14em]">
          Page <span className="num">1</span> / <span className="num">1</span>
        </div>
        <div className="mono text-[10px] text-[#A3A3A3] tracking-[0.14em] uppercase">
          Vigyaanrang Admin Console
        </div>
      </div>
    </footer>
  );
}

function Toolbar() {
  return (
    <div className="toolbar no-print">
      <button className="btn ghost" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
        ↑ Top
      </button>
      <button className="btn" onClick={() => window.print()}>
        Print / Export PDF
      </button>
    </div>
  );
}

function Report() {
  return (
    <>
      <Toolbar />
      <main className="sheet">
        <Header data={reportData} />
        <KpiRow data={reportData} />
        <GeoRow data={reportData} />
        <RevenueByEvent data={reportData} />
        <AtriaVsExternal data={reportData} />
        <TopExternal data={reportData} />
        <Footer data={reportData} />
      </main>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Report />);
  </script>
</body>
</html>`;
}
