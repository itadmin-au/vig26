// app/page.tsx
"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
    IconArrowRight, IconChevronDown, IconCalendarEvent,
    IconMapPin, IconBrandInstagram, IconBrandLinkedin,
    IconMail, IconPlus, IconMinus,
} from "@tabler/icons-react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// ── Data ──────────────────────────────────────────────────────────────────────

const EVENTS = [
    { category: "Tech",      title: "HackSprint 2026",       date: "Mar 18", image: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&q=80", color: "text-blue-400" },
    { category: "Cultural",  title: "Resonance Music Fest",  date: "Mar 19", image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80", color: "text-purple-400" },
    { category: "Workshop",  title: "AI/ML Bootcamp",        date: "Mar 20", image: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&q=80", color: "text-amber-400" },
    { category: "Esports",   title: "Pixel Clash Tournament", date: "Mar 21", image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80", color: "text-green-400" },
];

const FAQS = [
    { q: "Who can participate in Vigyanrang 2026?",         a: "All students from recognized colleges and universities across India are eligible to participate. Some events are open to Atria students only — check individual event pages for eligibility details." },
    { q: "How do I register for an event?",                 a: "Create an account on this platform, browse events, and click 'Register Now' on the event page. For paid events, payment is processed securely via Razorpay." },
    { q: "Are team registrations supported?",               a: "Yes. Several events support team registration. The team leader registers and adds teammates by email. All members receive individual QR-code tickets." },
    { q: "Will certificates be provided?",                  a: "Participation and winner certificates are issued digitally to all registered attendees. You can download them from your dashboard after the event." },
    { q: "What is the refund policy for paid events?",      a: "Refunds are available up to 48 hours before the event start time. After that, fees are non-refundable. Contact us at info@vigyanrang.com for exceptions." },
    { q: "Can I register for multiple events?",             a: "Absolutely. You can register for as many events as you like, subject to schedule availability. All your tickets will be visible in your dashboard." },
];

// ── Dot-grid SVG background ───────────────────────────────────────────────────
function DotGrid() {
    return (
        <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
                    <circle cx="1.5" cy="1.5" r="1.5" fill="#f97316" />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
    );
}

// ── FAQ Accordion item ────────────────────────────────────────────────────────
function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
    const [open, setOpen] = useState(false);
    const bodyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = bodyRef.current;
        if (!el) return;
        if (open) {
            gsap.to(el, { height: el.scrollHeight, opacity: 1, duration: 0.35, ease: "power2.out" });
        } else {
            gsap.to(el, { height: 0, opacity: 0, duration: 0.3, ease: "power2.in" });
        }
    }, [open]);

    return (
        <div className="border-b border-zinc-200 last:border-0">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between gap-6 py-5 text-left group"
            >
                <span className="text-sm font-medium text-zinc-800 group-hover:text-zinc-950 transition-colors">
                    <span className="text-orange-500 font-mono text-xs mr-3 opacity-60">
                        {String(index + 1).padStart(2, "0")}
                    </span>
                    {q}
                </span>
                <span className="shrink-0 text-zinc-400 group-hover:text-orange-500 transition-colors">
                    {open ? <IconMinus size={16} /> : <IconPlus size={16} />}
                </span>
            </button>
            <div ref={bodyRef} className="overflow-hidden h-0 opacity-0">
                <p className="text-sm text-zinc-500 leading-relaxed pb-5 pl-8">{a}</p>
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
    const pageRef = useRef<HTMLDivElement>(null);

    useGSAP(() => {
        // ── Hero stagger in ──────────────────────────────────────────────────
        const heroTl = gsap.timeline({ delay: 0.2 });
        heroTl
            .from(".hero-label",    { y: 20, opacity: 0, duration: 0.6, ease: "power3.out" })
            .from(".hero-h1",       { y: 60, opacity: 0, duration: 0.9, ease: "power4.out" }, "-=0.3")
            .from(".hero-sub",      { y: 20, opacity: 0, duration: 0.6, ease: "power3.out" }, "-=0.5")
            .from(".hero-ctas",     { y: 20, opacity: 0, duration: 0.6, ease: "power3.out" }, "-=0.4")
            .from(".hero-bottom",   { opacity: 0, duration: 0.8, ease: "power2.out" }, "-=0.2");

        // ── Scroll-triggered sections ────────────────────────────────────────
        const scrollFadeUp = (selector: string, stagger = 0) => {
            gsap.from(selector, {
                y: 50, opacity: 0, duration: 0.8, stagger, ease: "power3.out",
                scrollTrigger: { trigger: selector, start: "top 82%", toggleActions: "play none none none" },
            });
        };

        scrollFadeUp(".about-label");
        scrollFadeUp(".about-num");
        scrollFadeUp(".about-heading");
        scrollFadeUp(".about-body");
        scrollFadeUp(".about-stats", 0.1);
        scrollFadeUp(".about-img");

        scrollFadeUp(".events-label");
        scrollFadeUp(".events-heading");
        scrollFadeUp(".event-card", 0.1);
        scrollFadeUp(".events-cta");

        scrollFadeUp(".faq-heading");
        scrollFadeUp(".faq-item", 0.07);

        scrollFadeUp(".footer-col", 0.1);

        // ── About image parallax ─────────────────────────────────────────────
        gsap.to(".about-img-inner", {
            y: -40,
            ease: "none",
            scrollTrigger: {
                trigger: ".about-section",
                start: "top bottom",
                end: "bottom top",
                scrub: true,
            },
        });

    }, { scope: pageRef });

    return (
        <div ref={pageRef} className="-mt-16">

            {/* ── 1. HERO ──────────────────────────────────────────────────── */}
            <section className="relative min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 overflow-hidden">
                <DotGrid />

                {/* Radial glow behind headline */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-100 bg-orange-500/8 rounded-full blur-[100px] pointer-events-none" />

                <div className="relative z-10 text-center max-w-4xl mx-auto">
                    <p className="hero-label inline-flex items-center gap-2 text-[0.7rem] font-semibold text-orange-500 uppercase tracking-[0.2em] mb-6">
                        <span className="w-6 h-px bg-orange-500" />
                        Atria Institute of Technology · Bengaluru
                        <span className="w-6 h-px bg-orange-500" />
                    </p>

                    <h1 className="hero-h1 text-[clamp(3.5rem,10vw,8rem)] font-bold text-white leading-[0.95] tracking-[-0.04em] mb-6">
                        Vigyan<span className="text-orange-500">rang</span>
                        <br />
                        <span className="font-extralight text-white/40 text-[clamp(1.5rem,4vw,3rem)] tracking-[-0.02em]">
                            2026
                        </span>
                    </h1>

                    <p className="hero-sub text-zinc-400 text-[clamp(0.95rem,2vw,1.15rem)] max-w-lg mx-auto mb-10 leading-relaxed">
                        Two days of tech, culture, and competition. Where ideas collide and talent takes the stage.
                    </p>

                    <div className="hero-ctas flex items-center justify-center gap-3 flex-wrap">
                        <Link
                            href="/auth/signup"
                            className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-full transition-all duration-200 hover:gap-3"
                        >
                            Register Now
                            <IconArrowRight size={15} />
                        </Link>
                        <Link
                            href="/events"
                            className="px-6 py-3 border border-white/15 text-white/80 hover:text-white hover:border-white/40 text-sm font-medium rounded-full transition-all duration-200"
                        >
                            Explore Events
                        </Link>
                    </div>
                </div>

                {/* Bottom pinned date/location */}
                <div className="hero-bottom absolute bottom-8 left-0 right-0 flex items-center justify-center gap-6 text-[0.7rem] text-zinc-500 uppercase tracking-[0.18em]">
                    <span className="flex items-center gap-1.5">
                        <IconCalendarEvent size={12} className="text-orange-500" />
                        March 18–19, 2026
                    </span>
                    <span className="w-1 h-1 rounded-full bg-zinc-700" />
                    <span className="flex items-center gap-1.5">
                        <IconMapPin size={12} className="text-orange-500" />
                        Atria Institute of Technology
                    </span>
                </div>

                {/* Scroll indicator */}
                <div className="hero-bottom absolute bottom-8 right-8 flex flex-col items-center gap-1.5 text-zinc-600">
                    <span className="text-[0.6rem] uppercase tracking-widest rotate-90 mb-2">Scroll</span>
                    <IconChevronDown size={14} className="animate-bounce" />
                </div>
            </section>

            {/* ── 2. ABOUT ─────────────────────────────────────────────────── */}
            <section className="about-section bg-zinc-950 py-28 px-6 border-t border-white/5">
                <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">

                    {/* Left */}
                    <div>
                        <p className="about-label text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-orange-500 mb-4">
                            About the Fest
                        </p>

                        <div className="relative">
                            <span className="about-num absolute -top-8 -left-2 text-[8rem] font-bold text-white/3 leading-none select-none pointer-events-none">
                                02
                            </span>
                            <h2 className="about-heading relative text-[clamp(2rem,5vw,3.5rem)] font-bold text-white leading-[1.05] tracking-[-0.03em] mb-6">
                                Where curiosity<br />
                                <span className="text-orange-500">meets craft.</span>
                            </h2>
                        </div>

                        <p className="about-body text-zinc-400 text-base leading-relaxed mb-8 max-w-md">
                            Vigyanrang is Atria Institute of Technology's flagship annual fest — a two-day celebration bringing together students, innovators, and performers from across India. Compete, collaborate, and create memories that last beyond the classroom.
                        </p>

                        <div className="flex flex-wrap gap-3">
                            {[
                                { val: "40+",   label: "Events" },
                                { val: "1500+", label: "Participants" },
                                { val: "50+",   label: "Colleges" },
                            ].map((s) => (
                                <div key={s.label} className="about-stats flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/8 bg-white/3">
                                    <span className="text-lg font-bold text-orange-500 leading-none">{s.val}</span>
                                    <span className="text-xs text-zinc-400 font-medium">{s.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right — image with parallax */}
                    <div className="about-img relative h-120 rounded-2xl overflow-hidden">
                        <div className="about-img-inner absolute -inset-10">
                            <img
                                src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&q=80"
                                alt="Vigyanrang fest"
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-linear-to-t from-zinc-950/60 to-transparent" />
                        </div>
                        {/* Decorative corner accent */}
                        <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-orange-500/40 rounded-tr-lg" />
                        <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-orange-500/40 rounded-bl-lg" />
                    </div>
                </div>
            </section>

            {/* ── 3. EVENTS PREVIEW ────────────────────────────────────────── */}
            <section className="bg-zinc-900 py-28 px-6 border-t border-white/5">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
                        <div>
                            <p className="events-label text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-orange-500 mb-3">
                                Featured Events
                            </p>
                            <h2 className="events-heading text-[clamp(2rem,5vw,3rem)] font-bold text-white tracking-[-0.03em] leading-tight">
                                Something for<br />everyone.
                            </h2>
                        </div>
                        <Link
                            href="/events"
                            className="events-cta hidden sm:flex items-center gap-2 text-sm text-zinc-400 hover:text-orange-500 transition-colors font-medium"
                        >
                            View all events <IconArrowRight size={14} />
                        </Link>
                    </div>

                    {/* Cards grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {EVENTS.map((ev) => (
                            <Link
                                key={ev.title}
                                href="/events"
                                className="event-card group relative rounded-2xl overflow-hidden border border-white/6 bg-zinc-950 hover:border-orange-500/30 transition-all duration-300"
                            >
                                {/* Image */}
                                <div className="relative h-48 overflow-hidden">
                                    <img
                                        src={ev.image}
                                        alt={ev.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-linear-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                                    <span className={`absolute top-3 left-3 text-[0.65rem] font-semibold uppercase tracking-widest ${ev.color} bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full`}>
                                        {ev.category}
                                    </span>
                                </div>

                                {/* Content */}
                                <div className="p-4">
                                    <h3 className="text-sm font-semibold text-white leading-snug group-hover:text-orange-400 transition-colors mb-2">
                                        {ev.title}
                                    </h3>
                                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                        <IconCalendarEvent size={11} />
                                        {ev.date}, 2026
                                    </div>
                                </div>

                                {/* Hover arrow */}
                                <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <IconArrowRight size={12} className="text-white" />
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* Mobile CTA */}
                    <div className="mt-8 text-center sm:hidden">
                        <Link
                            href="/events"
                            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-orange-500 transition-colors font-medium"
                        >
                            View all events <IconArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── 4. FAQ ───────────────────────────────────────────────────── */}
            <section className="bg-white py-28 px-6">
                <div className="max-w-2xl mx-auto">
                    <div className="mb-12 text-center">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-orange-500 mb-3">
                            FAQ
                        </p>
                        <h2 className="faq-heading text-[clamp(2rem,5vw,3rem)] font-bold text-zinc-900 tracking-[-0.03em] leading-tight">
                            Got questions?
                        </h2>
                    </div>

                    <div>
                        {FAQS.map((faq, i) => (
                            <div key={i} className="faq-item">
                                <FaqItem q={faq.q} a={faq.a} index={i} />
                            </div>
                        ))}
                    </div>

                    <div className="mt-10 text-center">
                        <p className="text-sm text-zinc-400">
                            Still have questions?{" "}
                            <a href="mailto:info@vigyanrang.com" className="text-orange-500 hover:underline font-medium">
                                Email us
                            </a>
                        </p>
                    </div>
                </div>
            </section>

            {/* ── 5. FOOTER ────────────────────────────────────────────────── */}
            <footer className="bg-zinc-950 border-t border-white/6 pt-16 pb-8 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mb-12">

                        {/* Col 1 — Brand */}
                        <div className="footer-col">
                            <Link href="/" className="text-xl font-bold text-white tracking-[-0.03em] no-underline">
                                Vigyan<span className="text-orange-500">rang</span>
                            </Link>
                            <p className="text-sm text-zinc-500 mt-3 leading-relaxed max-w-50">
                                Annual technical & cultural fest of Atria Institute of Technology.
                            </p>
                            <div className="flex items-center gap-3 mt-5">
                                <a href="#" className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-zinc-500 hover:text-orange-500 hover:border-orange-500/40 transition-colors">
                                    <IconBrandInstagram size={14} />
                                </a>
                                <a href="#" className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-zinc-500 hover:text-orange-500 hover:border-orange-500/40 transition-colors">
                                    <IconBrandLinkedin size={14} />
                                </a>
                                <a href="mailto:info@vigyanrang.com" className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-zinc-500 hover:text-orange-500 hover:border-orange-500/40 transition-colors">
                                    <IconMail size={14} />
                                </a>
                            </div>
                        </div>

                        {/* Col 2 — Quick links */}
                        <div className="footer-col">
                            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-4">
                                Quick Links
                            </p>
                            <nav className="flex flex-col gap-2.5">
                                {[
                                    { label: "Home",      href: "/" },
                                    { label: "Events",    href: "/events" },
                                    { label: "Dashboard", href: "/dashboard" },
                                    { label: "Sign In",   href: "/auth/login" },
                                ].map((l) => (
                                    <Link
                                        key={l.label}
                                        href={l.href}
                                        className="text-sm text-zinc-400 hover:text-orange-500 transition-colors no-underline w-fit"
                                    >
                                        {l.label}
                                    </Link>
                                ))}
                            </nav>
                        </div>

                        {/* Col 3 — Contact */}
                        <div className="footer-col">
                            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-4">
                                Contact
                            </p>
                            <div className="flex flex-col gap-2.5 text-sm text-zinc-400">
                                <a href="mailto:info@vigyanrang.com" className="hover:text-orange-500 transition-colors no-underline">
                                    info@vigyanrang.com
                                </a>
                                <p>Atria Institute of Technology</p>
                                <p className="text-zinc-600 text-xs leading-relaxed">
                                    Anandnagar, Hebbal,<br />
                                    Bengaluru — 560 024
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Bottom bar */}
                    <div className="border-t border-white/5 pt-6 flex items-center justify-between gap-4 flex-wrap">
                        <p className="text-xs text-zinc-600">
                            © 2026 Vigyanrang · Atria Institute of Technology
                        </p>
                        <p className="text-xs text-zinc-600">
                            Developed by{" "}
                            <span className="text-zinc-400 font-medium">CodeClub AIT</span>
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}