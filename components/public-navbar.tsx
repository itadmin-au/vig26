// components/public-navbar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { IconArrowUpRight } from "@tabler/icons-react";

gsap.registerPlugin(useGSAP);

const NAV_LINKS = [
    { path: "/",          label: "Home",       num: "01" },
    { path: "/events",    label: "Events",     num: "02" },
    { path: "/dashboard", label: "My Tickets", num: "03", authRequired: true },
    { path: "/account",   label: "Account",    num: "04", authRequired: true },
];

const SOCIAL_LINKS = [
    { label: "Instagram ↗", href: "https://www.instagram.com/atria_it" },
    // { label: "Twitter / X ↗", href: "#" },
    { label: "LinkedIn ↗", href: "https://www.linkedin.com/school/atria-institute-of-technology/" },
];

type ContactPerson = {
    name: string;
    role?: string;
    phone: string;
};

type ContactEntry = {
    category: string;
    people: ContactPerson[];
};

type ContactSection = {
    title: string;
    entries: ContactEntry[];
};

const CONTACT_SECTIONS: ContactSection[] = [
    {
        title: "Faculty Coordinators",
        entries: [
            {
                category: "Technocultural Events",
                people: [
                    { name: "Dr. Sampada H K", role: "Assoc. Dean - Student Welfare", phone: "+91 99169 58940" },
                    { name: "Dr. Devi Kannan", role: "Prof. & HoD, Dept. of CSE", phone: "+91 94602 79588" },
                ],
            },
            {
                category: "Cultural Events",
                people: [
                    { name: "Dr. Archana R. Motta", role: "CCA Coordinator", phone: "+91 94489 36454" },
                    { name: "Mr. Bhaskar M K", role: "CCA Coordinator", phone: "+91 97415 94742" },
                ],
            },
            {
                category: "Sponsorship & Project Expo",
                people: [
                    { name: "Dr. Deepak N R", role: "Prof. & HoD, Dept. of ISE", phone: "+91 98864 67667" },
                ],
            },
            {
                category: "Hackathon",
                people: [
                    { name: "Ms. Keerthi K S", role: "Asst. Prof. Dept. of CSE", phone: "+91 97391 02765" },
                ],
            },
        ],
    },
    {
        title: "Student Coordinators",
        entries: [
            {
                category: "Hackathon & Technocultural Events",
                people: [
                    { name: "Sulaiman Shariff", phone: "+91 87923 45338" },
                ],
            },
            {
                category: "Cultural Events",
                people: [
                    { name: "Darshan", phone: "+91 63663 22531" },
                ],
            },
        ],
    },
];

export function PublicNavbar() {
    const { data: session } = useSession();
    const container = useRef<HTMLDivElement>(null);
    const tl = useRef<gsap.core.Timeline | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    const isDark = pathname === "/";

    useGSAP(() => {
        // Only set the overlay clip-path — don't touch vr-link-inner here
        // because session-gated links may not be mounted yet
        gsap.set(".vr-overlay",      { clipPath: "polygon(0 0, 100% 0, 100% 0, 0 0)" });
        gsap.set(".vr-overlay-bar",  { y: -20, opacity: 0 });
        gsap.set(".vr-overlay-meta", { y: 20,  opacity: 0 });
    }, { scope: container });

    function openMenu() {
        setIsOpen(true);

        // Query fresh every time so auth-gated links are always included
        const linkInners = container.current?.querySelectorAll(".vr-link-inner") ?? [];

        // Reset everything before playing
        gsap.set(".vr-overlay",      { clipPath: "polygon(0 0, 100% 0, 100% 0, 0 0)" });
        gsap.set(".vr-overlay-bar",  { y: -20, opacity: 0 });
        gsap.set(".vr-overlay-meta", { y: 20,  opacity: 0 });
        gsap.set(linkInners,         { y: 90,  opacity: 0 });

        tl.current = gsap.timeline()
            .to(".vr-overlay",      { clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)", duration: 0.9, ease: "power4.inOut" })
            .to(".vr-overlay-bar",  { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, "-=0.5")
            .to(linkInners,         { y: 0, opacity: 1, duration: 0.7, stagger: 0.07, ease: "power3.out" }, "-=0.4")
            .to(".vr-overlay-meta", { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, "-=0.35");
    }

    function closeMenu() {
        tl.current?.reverse().then(() => setIsOpen(false));
    }

    const role = (session?.user as { role?: string })?.role;
    const isManagement = role === "coordinator" || role === "dept_admin" || role === "super_admin";

    const visibleLinks = NAV_LINKS.filter((l) => !l.authRequired || !!session);
    const signOutIndex = String(visibleLinks.length + (isManagement ? 2 : 1)).padStart(2, "0");
    const facultyContacts = CONTACT_SECTIONS.find((section) => section.title === "Faculty Coordinators");
    const studentContacts = CONTACT_SECTIONS.find((section) => section.title === "Student Coordinators");

    return (
        <div ref={container} className="relative z-100">

            {/* ── Fixed top bar ──────────────────────────────────────────────── */}
            <header className={[
                "fixed top-0 left-0 w-full z-101",
                "flex items-center justify-between",
                "px-7 py-4",
                "transition-all duration-200",
                isDark
                    ? "bg-transparent border-b border-transparent"
                    : "bg-white/88 backdrop-blur-md border-b border-black/7 shadow-[0_1px_0_rgba(0,0,0,0.04)]",
            ].join(" ")}>

                <Link href="/" className="leading-none no-underline">
                    <Image
                        src="/vigyaanrang.png"
                        alt="Vigyanrang"
                        height={40}
                        width={200}
                        style={{ height: "40px", width: "auto", filter: isDark ? "none" : "brightness(0)" }}
                    />
                </Link>

                <div className="flex items-center gap-3.5">
                    {session ? (
                        <Link
                            href="/account"
                            className={[
                                "flex items-center gap-2 no-underline",
                                "pl-1 pr-1 sm:pr-3 py-1 rounded-full border transition-all duration-200",
                                isDark
                                    ? "border-white/15 hover:border-orange-500/50 hover:bg-orange-500/8"
                                    : "border-zinc-200 hover:border-orange-400/60 hover:bg-orange-50",
                            ].join(" ")}
                        >
                            <span className={[
                                "w-6.5 h-6.5 rounded-full text-[0.68rem] font-bold flex items-center justify-center shrink-0",
                                isDark ? "bg-white text-orange-500" : "bg-orange-500 text-white",
                            ].join(" ")}>
                                {session.user?.name?.[0]?.toUpperCase() ?? "U"}
                            </span>
                            <span className={[
                                "text-[0.8rem] font-medium max-w-28 truncate hidden sm:block",
                                isDark ? "text-white/80" : "text-zinc-700",
                            ].join(" ")}>
                                {session.user?.name?.split(" ")[0]}
                            </span>
                        </Link>
                    ) : (
                        <div className="hidden sm:flex items-center gap-2">
                            <Link
                                href="/auth/login"
                                className={[
                                    "text-[0.8rem] font-medium no-underline",
                                    "px-3.5 py-1.5 rounded-full border transition-all duration-200",
                                    isDark
                                        ? "text-white/70 border-white/20 hover:text-white hover:border-white/50"
                                        : "text-zinc-600 border-zinc-300 hover:text-zinc-900 hover:border-zinc-400",
                                ].join(" ")}
                            >
                                Sign In
                            </Link>
                            <Link
                                href="/auth/signup"
                                className={[
                                    "text-[0.8rem] font-semibold no-underline",
                                    "px-3.5 py-1.5 rounded-full border transition-all duration-200",
                                    isDark
                                        ? "text-zinc-900 bg-white border-white hover:bg-orange-50 hover:border-orange-100"
                                        : "text-white bg-orange-500 border-orange-500 hover:bg-orange-600 hover:border-orange-600",
                                ].join(" ")}
                            >
                                Sign Up
                            </Link>
                        </div>
                    )}

                    <button
                        onClick={openMenu}
                        aria-label="Open menu"
                        className="flex flex-col gap-1.25 bg-transparent border-none p-1 cursor-pointer group"
                    >
                        <span className={[
                            "block w-6 h-[1.5px] rounded-sm transition-all duration-300",
                            isDark ? "bg-white" : "bg-zinc-800",
                        ].join(" ")} />
                        <span className={[
                            "block w-6 h-[1.5px] rounded-sm transition-all duration-300 group-hover:w-4",
                            isDark ? "bg-white" : "bg-zinc-800",
                        ].join(" ")} />
                        <span className={[
                            "block w-6 h-[1.5px] rounded-sm transition-all duration-300 group-hover:w-4",
                            isDark ? "bg-white" : "bg-zinc-800",
                        ].join(" ")} />
                    </button>
                </div>
            </header>

            {/* ── Full-screen overlay — always dark ─────────────────────────── */}
            <div
                aria-hidden={!isOpen}
                className="vr-overlay fixed inset-0 w-screen h-screen bg-zinc-950 z-200 flex flex-col overflow-hidden"
            >
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-orange-500 via-orange-400 to-transparent z-10" />

                <div className="vr-overlay-bar flex items-center justify-between px-7 py-4 border-b border-white/6 shrink-0">
                    <Link href="/" onClick={closeMenu} className="leading-none no-underline">
                        <Image
                            src="/vigyaanrang.png"
                            alt="Vigyanrang"
                            height={40}
                            width={200}
                            style={{ height: "40px", width: "auto" }}
                        />
                    </Link>
                    <button
                        onClick={closeMenu}
                        aria-label="Close menu"
                        className="flex items-center gap-2 bg-transparent border border-white/12 text-white/65 px-3.5 py-1.5 rounded-full cursor-pointer text-[0.73rem] font-medium tracking-[0.06em] uppercase font-[inherit] transition-all duration-200 hover:border-orange-500 hover:text-orange-500 hover:bg-orange-500/6"
                    >
                        Close &nbsp;✕
                    </button>
                </div>

                <div className="flex-1 flex flex-col justify-between px-7 py-6 overflow-y-auto overflow-x-hidden gap-8">
                    <nav className="flex flex-col">
                        {visibleLinks.map((link) => (
                            <div
                                key={link.path}
                                className="vr-link-clip overflow-hidden border-b border-white/5 first:border-t first:border-white/5"
                            >
                                <div className="vr-link-inner">
                                    <Link
                                        href={link.path}
                                        onClick={closeMenu}
                                        className="group flex items-center gap-5 w-full py-2.5 no-underline text-white/85 transition-colors duration-200"
                                    >
                                        <span className="text-[0.6rem] text-white/18 font-medium tracking-widest w-8 shrink-0 pt-1">
                                            {link.num}
                                        </span>
                                        <span className="text-[clamp(1.9rem,4.5vw,3.4rem)] font-light tracking-[-0.03em] leading-none transition-colors duration-200 group-hover:text-orange-500">
                                            {link.label}
                                        </span>
                                        <IconArrowUpRight
                                            size={26}
                                            strokeWidth={1.5}
                                            className="ml-auto text-orange-500 opacity-0 shrink-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1"
                                        />
                                    </Link>
                                </div>
                            </div>
                        ))}

                        {/* Management Dashboard — management roles only */}
                        {isManagement && (
                            <div className="vr-link-clip overflow-hidden border-b border-white/5">
                                <div className="vr-link-inner">
                                    <Link
                                        href="/manage/dashboard"
                                        onClick={closeMenu}
                                        className="group flex items-center gap-5 w-full py-2.5 no-underline text-white/85 transition-colors duration-200"
                                    >
                                        <span className="text-[0.6rem] text-white/18 font-medium tracking-widest w-8 shrink-0 pt-1">
                                            {String(visibleLinks.length + 1).padStart(2, "0")}
                                        </span>
                                        <span className="text-[clamp(1.9rem,4.5vw,3.4rem)] font-light tracking-[-0.03em] leading-none transition-colors duration-200 group-hover:text-orange-500">
                                            Management
                                        </span>
                                        <IconArrowUpRight
                                            size={26}
                                            strokeWidth={1.5}
                                            className="ml-auto text-orange-500 opacity-0 shrink-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1"
                                        />
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Sign in / Sign out */}
                        <div className="vr-link-clip overflow-hidden border-b border-white/5">
                            <div className="vr-link-inner">
                                {session ? (
                                    <button
                                        onClick={() => { closeMenu(); signOut({ callbackUrl: "/" }); }}
                                        className="group flex items-center gap-5 w-full py-2.5 bg-transparent border-none cursor-pointer font-[inherit] text-white/85 transition-colors duration-200"
                                    >
                                        <span className="text-[0.6rem] text-white/18 font-medium tracking-widest w-8 shrink-0 pt-1">
                                            {signOutIndex}
                                        </span>
                                        <span className="text-[clamp(1.9rem,4.5vw,3.4rem)] font-light tracking-[-0.03em] leading-none text-white/28 transition-colors duration-200 group-hover:text-red-400/65">
                                            Sign Out
                                        </span>
                                    </button>
                                ) : (
                                    <Link
                                        href="/auth/login"
                                        onClick={closeMenu}
                                        className="group flex items-center gap-5 w-full py-2.5 no-underline text-white/85 transition-colors duration-200"
                                    >
                                        <span className="text-[0.6rem] text-white font-medium tracking-widest w-8 shrink-0 pt-1">
                                            {signOutIndex}
                                        </span>
                                        <span className="text-[clamp(1.9rem,4.5vw,3.4rem)] font-light tracking-[-0.03em] leading-none transition-colors duration-200 group-hover:text-orange-500">
                                            Sign In
                                        </span>
                                        <IconArrowUpRight
                                            size={26}
                                            strokeWidth={1.5}
                                            className="ml-auto text-orange-500 opacity-0 shrink-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1"
                                        />
                                    </Link>
                                )}
                            </div>
                        </div>
                    </nav>

                    {/* Footer meta */}
                    <div className="vr-overlay-meta flex gap-8 pt-6 border-t border-white/6 flex-wrap lg:flex-nowrap">
                        <div className="flex flex-col gap-4 flex-1 min-w-44">
                            <div className="space-y-0.5">
                                <p className="text-[0.76rem] text-white/80 normal-case tracking-normal font-normal leading-[1.7]">
                                    Atria Institute of Technology
                                </p>
                                <p className="text-[0.76rem] text-orange-500 normal-case tracking-normal font-normal leading-[1.7]">
                                    Technical & Cultural Fest 2026
                                </p>
                            </div>
                            <div className="relative w-full max-w-md rounded-xl overflow-hidden">
                                <Image
                                    src="/atria_bg.png"
                                    alt="Atria campus banner"
                                    width={420}
                                    height={240}
                                    className="w-full h-auto object-cover"
                                />
                            </div>
                            <p className="text-[0.6rem] font-medium tracking-[0.12em] uppercase text-white/40 mb-0">
                                Follow
                            </p>
                            <div className="flex items-center gap-4 whitespace-nowrap">
                                {SOCIAL_LINKS.map((s) => (
                                    <a
                                        key={s.label}
                                        href={s.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[0.78rem] text-white/50 no-underline normal-case tracking-normal font-normal leading-[1.45] hover:text-orange-500 transition-colors duration-200"
                                    >
                                        {s.label}
                                    </a>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 flex-[1.35] min-w-76">
                            <p className="text-[0.6rem] font-medium tracking-[0.12em] uppercase text-white/40 mb-1">
                                Contact
                            </p>
                            {facultyContacts && (
                                <div className="space-y-2.5">
                                    <p className="text-[0.7rem] text-orange-400 font-semibold tracking-[0.08em] uppercase">
                                        {facultyContacts.title}
                                    </p>
                                    {facultyContacts.entries.map((entry) => (
                                        <div key={`${facultyContacts.title}-${entry.category}`} className="space-y-0.5">
                                            <p className="text-[0.72rem] text-white/80 font-medium leading-snug">
                                                {entry.category}
                                            </p>
                                            {entry.people.map((person) => (
                                                <p key={`${entry.category}-${person.name}`} className="text-[0.72rem] text-white/55 leading-snug">
                                                    <span className="text-white/85 font-medium">{person.name}</span>
                                                    {person.role ? ` - ${person.role}` : ""}
                                                    <span className="text-orange-400"> {person.phone}</span>
                                                </p>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3 flex-1 min-w-56 items-start text-left lg:items-end lg:text-right">
                            {studentContacts && (
                                <div className="space-y-2.5">
                                    <p className="text-[0.7rem] text-orange-400 font-semibold tracking-[0.08em] uppercase">
                                        {studentContacts.title}
                                    </p>
                                    {studentContacts.entries.map((entry) => (
                                        <div key={`${studentContacts.title}-${entry.category}`} className="space-y-0.5">
                                            <p className="text-[0.72rem] text-white/80 font-medium leading-snug">
                                                {entry.category}
                                            </p>
                                            {entry.people.map((person) => (
                                                <p key={`${entry.category}-${person.name}`} className="text-[0.72rem] text-white/55 leading-snug">
                                                    <span className="text-white/85 font-medium">{person.name}</span>
                                                    <span className="text-orange-400"> {person.phone}</span>
                                                </p>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}