"use client";

// app/page.tsx — Vigyanrang Landing Page
// GSAP paper-board animation: sections fly in like posters being pinned to a board
// Install: npm install gsap @gsap/react

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// ─── Constants ────────────────────────────────────────────────────────────────

// Update this to the actual fest date
const FEST_DATE = new Date("2026-04-15T09:00:00+05:30");

const CATEGORIES = [
  { label: "Tech", slug: "tech", icon: "⚡", color: "#f97316" },
  { label: "Cultural", slug: "cultural", icon: "🎭", color: "#a78bfa" },
  { label: "Workshop", slug: "workshop", icon: "🔧", color: "#34d399" },
  { label: "Hackathon", slug: "hackathon", icon: "💻", color: "#60a5fa" },
  { label: "Esports", slug: "esports", icon: "🎮", color: "#f43f5e" },
  { label: "Sports", slug: "sports", icon: "🏆", color: "#fbbf24" },
];

const STATS = [
  { value: "50+", label: "Events" },
  { value: "2000+", label: "Students" },
  { value: "15+", label: "Departments" },
  { value: "3", label: "Days" },
];

// ─── Countdown ────────────────────────────────────────────────────────────────

function useCountdown(target: Date) {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    function tick() {
      const diff = Math.max(0, target.getTime() - Date.now());
      setTime({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return time;
}

// ─── Paper texture overlay ────────────────────────────────────────────────────

function PaperTexture() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.035] mix-blend-overlay"
      xmlns="http://www.w3.org/2000/svg"
    >
      <filter id="noise">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.85"
          numOctaves="4"
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#noise)" />
    </svg>
  );
}

// ─── Countdown digit ──────────────────────────────────────────────────────────

function DigitCard({ value, label }: { value: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current !== value && ref.current) {
      gsap.fromTo(
        ref.current,
        { y: -8, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.25, ease: "back.out(2)" }
      );
    }
    prev.current = value;
  }, [value]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        ref={ref}
        className="relative w-16 h-20 md:w-24 md:h-28 flex items-center justify-center rounded-xl overflow-hidden"
        style={{
          background: "linear-gradient(145deg, #1c1c1e, #111113)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* paper crease line */}
        <div
          className="absolute inset-x-0 top-1/2 h-px"
          style={{ background: "rgba(0,0,0,0.4)" }}
        />
        <span
          className="text-4xl md:text-6xl font-black tabular-nums leading-none"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            color: "#f97316",
            textShadow: "0 0 24px rgba(249,115,22,0.4)",
          }}
        >
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">
        {label}
      </span>
    </div>
  );
}

// ─── Category tile ────────────────────────────────────────────────────────────

function CategoryTile({
  cat,
  index,
}: {
  cat: (typeof CATEGORIES)[0];
  index: number;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  // Subtle magnetic hover
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      gsap.to(el, {
        x: dx * 6,
        y: dy * 6,
        rotateX: -dy * 4,
        rotateY: dx * 4,
        duration: 0.3,
        ease: "power2.out",
      });
    }
    function onLeave() {
      gsap.to(el, { x: 0, y: 0, rotateX: 0, rotateY: 0, duration: 0.5, ease: "elastic.out(1,0.5)" });
    }

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  // Staggered random initial rotation for "pinned to board" look
  const rotations = [-2.5, 1.8, -1.2, 2.1, -1.8, 1.4];
  const rot = rotations[index % rotations.length];

  return (
    <Link
      ref={ref}
      href={`/events?category=${cat.slug}`}
      className="category-tile relative flex flex-col items-start gap-3 p-5 rounded-2xl overflow-hidden cursor-pointer group"
      style={{
        background: "linear-gradient(145deg, #1a1a1c, #141416)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        transform: `rotate(${rot}deg)`,
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
    >
      {/* Colour wash */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(circle at 30% 30%, ${cat.color}18, transparent 70%)` }}
      />
      {/* Torn edge top */}
      <div
        className="absolute top-0 inset-x-0 h-1"
        style={{ background: `${cat.color}40` }}
      />
      <span className="text-3xl relative z-10">{cat.icon}</span>
      <span
        className="text-base font-bold relative z-10 tracking-tight"
        style={{ color: cat.color }}
      >
        {cat.label}
      </span>
      <span className="text-xs text-zinc-500 relative z-10 group-hover:text-zinc-300 transition-colors">
        View events →
      </span>
    </Link>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    gsap.fromTo(
      ref.current,
      { y: -20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power3.out", delay: 0.1 }
    );
  });

  return (
    <nav
      ref={ref}
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-10 h-14"
      style={{
        background: "rgba(9,9,11,0.7)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <span
        className="text-lg font-black tracking-tight"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        Vigyan<span style={{ color: "#f97316" }}>rang</span>
      </span>
      <div className="flex items-center gap-3">
        <Link
          href="/events"
          className="hidden sm:inline-flex text-sm text-zinc-400 hover:text-white transition-colors px-3 py-1.5"
        >
          Events
        </Link>
        <Link
          href="/auth/login"
          className="text-sm font-semibold px-4 py-1.5 rounded-lg transition-all"
          style={{ background: "#f97316", color: "#fff" }}
        >
          Register
        </Link>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const countdown = useCountdown(FEST_DATE);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

      tl.fromTo(
        headingRef.current,
        { y: 60, opacity: 0, filter: "blur(8px)" },
        { y: 0, opacity: 1, filter: "blur(0px)", duration: 1, delay: 0.3 }
      )
        .fromTo(
          subRef.current,
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7 },
          "-=0.5"
        )
        .fromTo(
          ctaRef.current,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6 },
          "-=0.4"
        );
    },
    { scope: containerRef }
  );

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-10 overflow-hidden"
    >
      {/* Background: concentric rings */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(249,115,22,0.07) 0%, transparent 70%)",
        }}
      />
      {[320, 520, 720, 920].map((r) => (
        <div
          key={r}
          className="absolute rounded-full border"
          style={{
            width: r,
            height: r,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            borderColor: "rgba(249,115,22,0.06)",
          }}
        />
      ))}

      <PaperTexture />

      {/* Pill */}
      <div
        className="mb-6 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest"
        style={{
          background: "rgba(249,115,22,0.12)",
          border: "1px solid rgba(249,115,22,0.25)",
          color: "#f97316",
        }}
      >
        Atria Institute of Technology · April 2026
      </div>

      <h1
        ref={headingRef}
        className="text-center font-black leading-none tracking-tighter mb-4"
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "clamp(3.5rem, 12vw, 9rem)",
          color: "#fff",
        }}
      >
        Vigyan
        <span style={{ color: "#f97316", display: "inline-block" }}>rang</span>
      </h1>

      <p
        ref={subRef}
        className="text-center max-w-md text-base md:text-lg mb-10"
        style={{ color: "#71717a", lineHeight: 1.65 }}
      >
        The annual technical and cultural fest. Three days of innovation,
        competition, and celebration.
      </p>

      {/* Countdown */}
      <div className="flex items-start gap-3 md:gap-5 mb-10">
        <DigitCard value={countdown.d} label="Days" />
        <span className="text-4xl md:text-6xl font-black text-zinc-700 mt-3 md:mt-4 select-none">:</span>
        <DigitCard value={countdown.h} label="Hours" />
        <span className="text-4xl md:text-6xl font-black text-zinc-700 mt-3 md:mt-4 select-none">:</span>
        <DigitCard value={countdown.m} label="Mins" />
        <span className="text-4xl md:text-6xl font-black text-zinc-700 mt-3 md:mt-4 select-none">:</span>
        <DigitCard value={countdown.s} label="Secs" />
      </div>

      {/* CTA */}
      <div ref={ctaRef} className="flex items-center gap-3">
        <Link
          href="/events"
          className="px-7 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95"
          style={{
            background: "#f97316",
            color: "#fff",
            boxShadow: "0 0 32px rgba(249,115,22,0.35)",
          }}
        >
          Explore Events
        </Link>
        <Link
          href="/auth/signup"
          className="px-7 py-3 rounded-xl text-sm font-bold transition-all hover:bg-white/10"
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#a1a1aa",
          }}
        >
          Create Account
        </Link>
      </div>

      {/* Scroll cue */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40"
        style={{ animation: "scrollBob 2s ease-in-out infinite" }}
      >
        <span className="text-xs uppercase tracking-widest text-zinc-500">Scroll</span>
        <div className="w-px h-8 bg-linear-to-b from-zinc-500 to-transparent" />
      </div>

      <style>{`
        @keyframes scrollBob {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(6px); }
        }
      `}</style>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function Stats() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        ".stat-item",
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.12,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ref.current,
            start: "top 80%",
          },
        }
      );
    },
    { scope: ref }
  );

  return (
    <section ref={ref} className="relative py-16 px-6 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, transparent, rgba(249,115,22,0.03), transparent)" }}
      />
      <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="stat-item flex flex-col items-center gap-1 py-8 rounded-2xl"
            style={{
              background: "linear-gradient(145deg, #131315, #0f0f11)",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
            }}
          >
            <span
              className="text-4xl md:text-5xl font-black tabular-nums"
              style={{ color: "#f97316", fontFamily: "'DM Sans', sans-serif" }}
            >
              {s.value}
            </span>
            <span className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Categories ───────────────────────────────────────────────────────────────

function Categories() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Tiles fly in like papers being tossed onto a board
      gsap.fromTo(
        ".category-tile",
        {
          y: () => gsap.utils.random(60, 120),
          x: () => gsap.utils.random(-30, 30),
          rotation: () => gsap.utils.random(-8, 8),
          opacity: 0,
          scale: 0.88,
        },
        {
          y: 0,
          x: 0,
          // keep the small permanent rotation defined inline
          opacity: 1,
          scale: 1,
          stagger: {
            each: 0.08,
            from: "random",
          },
          duration: 0.8,
          ease: "back.out(1.4)",
          scrollTrigger: {
            trigger: ref.current,
            start: "top 75%",
          },
        }
      );
    },
    { scope: ref }
  );

  return (
    <section ref={ref} className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <SectionLabel label="Categories" />
        <h2
          className="text-3xl md:text-5xl font-black text-white mb-10 tracking-tight"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Find your event
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-6">
          {CATEGORIES.map((cat, i) => (
            <CategoryTile key={cat.slug} cat={cat} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Featured Events (placeholder cards for now — will hydrate from DB) ───────

function FeaturedEvents() {
  const ref = useRef<HTMLDivElement>(null);

  // Cards animate like posters being pinned to a noticeboard
  useGSAP(
    () => {
      const cards = gsap.utils.toArray<HTMLElement>(".event-card");

      cards.forEach((card, i) => {
        const fromLeft = i % 2 === 0;
        gsap.fromTo(
          card,
          {
            x: fromLeft ? -80 : 80,
            y: 40,
            rotation: fromLeft ? -4 : 4,
            opacity: 0,
          },
          {
            x: 0,
            y: 0,
            rotation: 0,
            opacity: 1,
            duration: 0.9,
            ease: "expo.out",
            scrollTrigger: {
              trigger: card,
              start: "top 82%",
            },
          }
        );
      });
    },
    { scope: ref }
  );

  // Placeholder cards — replace with real DB data via server component wrapper
  const PLACEHOLDER_EVENTS = [
    {
      id: "1",
      title: "Code Clash",
      category: "hackathon",
      type: "inter",
      date: "Apr 15, 2026",
      price: 0,
      color: "#60a5fa",
    },
    {
      id: "2",
      title: "Robo Rumble",
      category: "tech",
      type: "inter",
      date: "Apr 15, 2026",
      price: 150,
      color: "#f97316",
    },
    {
      id: "3",
      title: "Battle of Bands",
      category: "cultural",
      type: "inter",
      date: "Apr 16, 2026",
      price: 100,
      color: "#a78bfa",
    },
  ];

  return (
    <section ref={ref} className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <SectionLabel label="Featured" />
        <div className="flex items-end justify-between mb-10">
          <h2
            className="text-3xl md:text-5xl font-black text-white tracking-tight"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Headline events
          </h2>
          <Link
            href="/events"
            className="text-sm text-zinc-500 hover:text-orange-400 transition-colors hidden sm:block"
          >
            View all →
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {PLACEHOLDER_EVENTS.map((ev) => (
            <Link
              key={ev.id}
              href={`/events`}
              className="event-card relative flex flex-col justify-between p-5 rounded-2xl overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
              style={{
                background: "linear-gradient(145deg, #161618, #111113)",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "0 6px 32px rgba(0,0,0,0.4)",
                minHeight: 180,
              }}
            >
              {/* colour accent strip */}
              <div
                className="absolute top-0 inset-x-0 h-1 transition-all duration-300 group-hover:h-1.5"
                style={{ background: ev.color }}
              />
              {/* Subtle glow on hover */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: `radial-gradient(circle at 20% 20%, ${ev.color}14, transparent 60%)`,
                }}
              />
              <div className="relative z-10">
                <span
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: ev.color }}
                >
                  {ev.category}
                </span>
                <h3 className="text-lg font-black text-white mt-2 tracking-tight">
                  {ev.title}
                </h3>
              </div>
              <div className="relative z-10 flex items-center justify-between mt-4">
                <span className="text-xs text-zinc-500">{ev.date}</span>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={
                    ev.price === 0
                      ? { background: "rgba(52,211,153,0.15)", color: "#34d399" }
                      : { background: "rgba(255,255,255,0.06)", color: "#a1a1aa" }
                  }
                >
                  {ev.price === 0 ? "Free" : `₹${ev.price}`}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 text-center sm:hidden">
          <Link
            href="/events"
            className="text-sm text-zinc-500 hover:text-orange-400 transition-colors"
          >
            View all events →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── CTA Banner ───────────────────────────────────────────────────────────────

function CTABanner() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        ref.current,
        { y: 50, opacity: 0, scale: 0.97 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.9,
          ease: "expo.out",
          scrollTrigger: {
            trigger: ref.current,
            start: "top 80%",
          },
        }
      );
    },
    { scope: ref }
  );

  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div
          ref={ref}
          className="relative overflow-hidden rounded-3xl p-10 md:p-14 text-center"
          style={{
            background: "linear-gradient(135deg, #1a0e06, #1c1008, #0f0f11)",
            border: "1px solid rgba(249,115,22,0.2)",
            boxShadow: "0 0 80px rgba(249,115,22,0.08)",
          }}
        >
          <PaperTexture />
          {/* decorative rings */}
          <div
            className="absolute -right-20 -top-20 w-72 h-72 rounded-full border"
            style={{ borderColor: "rgba(249,115,22,0.08)" }}
          />
          <div
            className="absolute -left-10 -bottom-10 w-48 h-48 rounded-full border"
            style={{ borderColor: "rgba(249,115,22,0.06)" }}
          />

          <p
            className="text-xs font-bold uppercase tracking-widest mb-4 relative z-10"
            style={{ color: "#f97316" }}
          >
            Registration open
          </p>
          <h2
            className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight relative z-10"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Ready to compete?
          </h2>
          <p className="text-zinc-400 mb-8 max-w-md mx-auto relative z-10">
            Create your account, pick your events, and show up to win.
          </p>
          <div className="flex items-center justify-center gap-3 relative z-10">
            <Link
              href="/auth/signup"
              className="px-8 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95"
              style={{
                background: "#f97316",
                color: "#fff",
                boxShadow: "0 0 32px rgba(249,115,22,0.3)",
              }}
            >
              Sign up free
            </Link>
            <Link
              href="/events"
              className="px-8 py-3 rounded-xl font-bold text-sm transition-all"
              style={{
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#71717a",
              }}
            >
              Browse events
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      className="py-10 px-6 border-t"
      style={{ borderColor: "rgba(255,255,255,0.05)" }}
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <span
          className="text-base font-black"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Vigyan<span style={{ color: "#f97316" }}>rang</span>
          <span className="text-zinc-600 font-normal text-sm ml-2">
            · Atria Institute of Technology
          </span>
        </span>
        <div className="flex items-center gap-5 text-sm text-zinc-600">
          <Link href="/events" className="hover:text-zinc-300 transition-colors">
            Events
          </Link>
          <Link href="/auth/login" className="hover:text-zinc-300 transition-colors">
            Login
          </Link>
          <Link
            href="/manage/login"
            className="hover:text-zinc-300 transition-colors"
          >
            Management
          </Link>
        </div>
      </div>
    </footer>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <p
      className="text-xs font-bold uppercase tracking-widest mb-3"
      style={{ color: "#f97316" }}
    >
      {label}
    </p>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <main
      style={{
        background: "#09090b",
        color: "#e4e4e7",
        fontFamily: "'DM Sans', sans-serif",
        overflowX: "hidden",
      }}
    >
      <Nav />
      <Hero />
      <Stats />
      <Categories />
      <FeaturedEvents />
      <CTABanner />
      <Footer />
    </main>
  );
}