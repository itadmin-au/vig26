// components/public-navbar.tsx
"use client";

import Link from "next/link";
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
    { label: "Instagram ↗", href: "#" },
    { label: "Twitter / X ↗", href: "#" },
    { label: "LinkedIn ↗", href: "#" },
];

export function PublicNavbar() {
    const { data: session } = useSession();
    const container = useRef<HTMLDivElement>(null);
    const tl = useRef<gsap.core.Timeline | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    // Home page has a dark background — use white text.
    // Every other public page is light (bg-zinc-50) — use dark text.
    const isDark = pathname === "/";

    useGSAP(() => {
        gsap.set(".vr-overlay",      { clipPath: "polygon(0 0, 100% 0, 100% 0, 0 0)" });
        gsap.set(".vr-link-inner",   { y: 90, opacity: 0 });
        gsap.set(".vr-overlay-meta", { y: 20, opacity: 0 });
        gsap.set(".vr-overlay-bar",  { y: -20, opacity: 0 });

        tl.current = gsap.timeline({ paused: true })
            .to(".vr-overlay",      { clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)", duration: 0.9, ease: "power4.inOut" })
            .to(".vr-overlay-bar",  { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, "-=0.5")
            .to(".vr-link-inner",   { y: 0, opacity: 1, duration: 0.7, stagger: 0.07, ease: "power3.out" }, "-=0.4")
            .to(".vr-overlay-meta", { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, "-=0.35");
    }, { scope: container });

    function openMenu()  { setIsOpen(true);  tl.current?.play(); }
    function closeMenu() { tl.current?.reverse().then(() => setIsOpen(false)); }

    const visibleLinks  = NAV_LINKS.filter((l) => !l.authRequired || !!session);
    const signOutIndex  = String(visibleLinks.length + 1).padStart(2, "0");

    // ── Theme tokens ──────────────────────────────────────────────────────────
    const logo      = isDark ? "text-white" : "text-zinc-900";
    const hamLine   = isDark ? "bg-white" : "bg-zinc-800";
    const ghostBtn  = isDark
        ? "text-white/70 border-white/20 hover:text-white hover:border-white/50"
        : "text-zinc-600 border-zinc-300 hover:text-zinc-900 hover:border-zinc-400";
    const pillBorder = isDark
        ? "border-white/15 hover:border-orange-500/50 hover:bg-orange-500/08"
        : "border-zinc-200 hover:border-orange-400/60 hover:bg-orange-50";
    const pillName  = isDark ? "text-white/80" : "text-zinc-700";

    return (
        <div ref={container} className="vr-root">

            {/* ── Fixed top bar ──────────────────────────────────────────── */}
            <header className={`vr-topbar ${!isDark ? "vr-topbar--light" : ""}`}>
                <Link href="/" className={`vr-logo ${logo}`}>
                    Vigyan<span className="text-orange-500">rang</span>
                </Link>

                <div className="vr-topbar-right">
                    {session ? (
                        /* Profile pill */
                        <Link href="/account" className={`vr-profile-pill ${pillBorder}`}>
                            <span className="vr-avatar">
                                {session.user?.name?.[0]?.toUpperCase() ?? "U"}
                            </span>
                            <span className={`vr-profile-name ${pillName}`}>
                                {session.user?.name?.split(" ")[0]}
                            </span>
                        </Link>
                    ) : (
                        /* Auth buttons */
                        <div className="vr-auth-btns">
                            <Link href="/auth/login"  className={`vr-btn-ghost ${ghostBtn}`}>Sign In</Link>
                            <Link href="/auth/signup" className="vr-btn-orange">Sign Up</Link>
                        </div>
                    )}

                    {/* Hamburger */}
                    <button className="vr-hamburger" onClick={openMenu} aria-label="Open menu">
                        <span className={`vr-line ${hamLine}`} />
                        <span className={`vr-line ${hamLine}`} />
                        <span className={`vr-line ${hamLine}`} />
                    </button>
                </div>
            </header>

            {/* ── Full-screen overlay (always dark) ─────────────────────── */}
            <div className="vr-overlay" aria-hidden={!isOpen}>
                <div className="vr-overlay-bar">
                    <Link href="/" className="vr-logo text-white" onClick={closeMenu}>
                        Vigyan<span className="text-orange-500">rang</span>
                    </Link>
                    <button className="vr-close-btn" onClick={closeMenu} aria-label="Close">
                        Close &nbsp;✕
                    </button>
                </div>

                <div className="vr-overlay-body">
                    <nav className="vr-nav">
                        {visibleLinks.map((link) => (
                            <div className="vr-link-clip" key={link.path}>
                                <div className="vr-link-inner">
                                    <Link href={link.path} className="vr-nav-link" onClick={closeMenu}>
                                        <span className="vr-num">{link.num}</span>
                                        <span className="vr-label">{link.label}</span>
                                        <IconArrowUpRight size={26} className="vr-arrow" strokeWidth={1.5} />
                                    </Link>
                                </div>
                            </div>
                        ))}

                        <div className="vr-link-clip">
                            <div className="vr-link-inner">
                                {session ? (
                                    <button
                                        className="vr-nav-link vr-nav-btn"
                                        onClick={() => { closeMenu(); signOut({ callbackUrl: "/" }); }}
                                    >
                                        <span className="vr-num">{signOutIndex}</span>
                                        <span className="vr-label vr-label--muted">Sign Out</span>
                                    </button>
                                ) : (
                                    <Link href="/auth/login" className="vr-nav-link" onClick={closeMenu}>
                                        <span className="vr-num">{signOutIndex}</span>
                                        <span className="vr-label">Sign In</span>
                                        <IconArrowUpRight size={26} className="vr-arrow" strokeWidth={1.5} />
                                    </Link>
                                )}
                            </div>
                        </div>
                    </nav>

                    <div className="vr-overlay-meta">
                        <div className="vr-meta-col">
                            <p className="vr-meta-heading">Follow</p>
                            {SOCIAL_LINKS.map((s) => (
                                <a key={s.label} href={s.href} className="vr-meta-link">{s.label}</a>
                            ))}
                        </div>
                        <div className="vr-meta-col">
                            <p className="vr-meta-heading">Contact</p>
                            <a href="mailto:info@vigyanrang.com" className="vr-meta-link">info@vigyanrang.com</a>
                            {session && (
                                <p className="vr-meta-user">
                                    Signed in as <span>{session.user?.name?.split(" ")[0]}</span>
                                </p>
                            )}
                        </div>
                        <div className="vr-meta-col vr-meta-col--right">
                            <p className="vr-meta-tag">Atria Institute of Technology</p>
                            <p className="vr-meta-tag vr-meta-tag--orange">Technical & Cultural Fest 2026</p>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .vr-root { position: relative; z-index: 100; }

                /* ── Top bar — transparent, no bg ─────────────────────────── */
                .vr-topbar {
                    position: fixed;
                    top: 0; left: 0;
                    width: 100%;
                    padding: 1rem 1.75rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    z-index: 101;
                    /* Light pages get a subtle white border at the bottom */
                    border-bottom: 1px solid transparent;
                    background: transparent;
                    transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
                }

                /* ── Light page topbar (non-home) ────────────────────────── */
                .vr-topbar--light {
                    border-bottom-color: rgba(0,0,0,0.07) !important;
                    background: rgba(250,250,250,0.88) !important;
                    backdrop-filter: blur(14px);
                    -webkit-backdrop-filter: blur(14px);
                    box-shadow: 0 1px 0 rgba(0,0,0,0.04);
                }

                /* ── Logo ─────────────────────────────────────────────────── */
                .vr-logo {
                    font-size: 1.05rem;
                    font-weight: 700;
                    text-decoration: none;
                    letter-spacing: -0.03em;
                    line-height: 1;
                }

                /* ── Right side ──────────────────────────────────────────── */
                .vr-topbar-right {
                    display: flex;
                    align-items: center;
                    gap: 0.875rem;
                }

                /* ── Auth buttons ─────────────────────────────────────────── */
                .vr-auth-btns { display: flex; align-items: center; gap: 0.5rem; }

                .vr-btn-ghost {
                    font-size: 0.8rem;
                    font-weight: 500;
                    text-decoration: none;
                    padding: 0.38rem 0.85rem;
                    border-radius: 100px;
                    border: 1px solid;
                    transition: color 0.2s, border-color 0.2s;
                }

                .vr-btn-orange {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #fff;
                    text-decoration: none;
                    padding: 0.38rem 0.9rem;
                    border-radius: 100px;
                    background: #f97316;
                    transition: background 0.2s;
                }
                .vr-btn-orange:hover { background: #ea6c10; }

                /* ── Profile pill ─────────────────────────────────────────── */
                .vr-profile-pill {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    text-decoration: none;
                    padding: 0.28rem 0.75rem 0.28rem 0.28rem;
                    border-radius: 100px;
                    border: 1px solid;
                    transition: border-color 0.2s, background 0.2s;
                }

                .vr-avatar {
                    width: 1.6rem;
                    height: 1.6rem;
                    border-radius: 50%;
                    background: #f97316;
                    color: #fff;
                    font-size: 0.68rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .vr-profile-name {
                    font-size: 0.8rem;
                    font-weight: 500;
                    max-width: 7rem;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                /* ── Hamburger ────────────────────────────────────────────── */
                .vr-hamburger {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                    cursor: pointer;
                    background: none;
                    border: none;
                    padding: 4px;
                }
                .vr-line {
                    display: block;
                    width: 24px;
                    height: 1.5px;
                    border-radius: 2px;
                    transition: width 0.3s ease;
                }
                .vr-hamburger:hover .vr-line:last-child { width: 15px; }

                /* ── Overlay (always zinc-950 dark) ──────────────────────── */
                .vr-overlay {
                    position: fixed;
                    inset: 0;
                    background: #09090b;
                    z-index: 200;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .vr-overlay::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0;
                    height: 2px;
                    background: linear-gradient(90deg, #f97316, #fb923c, #fdba74, transparent);
                }

                .vr-overlay-bar {
                    padding: 1rem 1.75rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                    flex-shrink: 0;
                }

                .vr-close-btn {
                    background: none;
                    border: 1px solid rgba(255,255,255,0.12);
                    color: rgba(255,255,255,0.65);
                    padding: 0.38rem 0.9rem;
                    border-radius: 100px;
                    cursor: pointer;
                    font-size: 0.73rem;
                    font-weight: 500;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                    font-family: inherit;
                    transition: border-color 0.2s, color 0.2s, background 0.2s;
                }
                .vr-close-btn:hover {
                    border-color: #f97316;
                    color: #f97316;
                    background: rgba(249,115,22,0.06);
                }

                .vr-overlay-body {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    padding: 1.5rem 1.75rem 2.5rem;
                    overflow: hidden;
                }

                .vr-nav { display: flex; flex-direction: column; }
                .vr-link-clip {
                    overflow: hidden;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .vr-link-clip:first-child { border-top: 1px solid rgba(255,255,255,0.05); }

                .vr-nav-link, .vr-nav-btn {
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    width: 100%;
                    padding: 0.65rem 0;
                    text-decoration: none;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-family: inherit;
                    color: rgba(255,255,255,0.85);
                    transition: color 0.2s;
                }
                .vr-nav-link:hover .vr-label   { color: #f97316; }
                .vr-nav-link:hover .vr-arrow    { opacity: 1; transform: translateX(4px) translateY(-4px); }
                .vr-nav-btn:hover  .vr-label--muted { color: rgba(255,100,100,0.65); }

                .vr-num {
                    font-size: 0.6rem;
                    color: rgba(255,255,255,0.18);
                    font-weight: 500;
                    letter-spacing: 0.1em;
                    width: 2rem;
                    flex-shrink: 0;
                    padding-top: 3px;
                }
                .vr-label {
                    font-size: clamp(1.9rem, 4.5vw, 3.4rem);
                    font-weight: 300;
                    letter-spacing: -0.03em;
                    line-height: 1;
                    transition: color 0.25s ease;
                }
                .vr-label--muted { color: rgba(255,255,255,0.28); }

                .vr-arrow {
                    opacity: 0;
                    transition: opacity 0.2s, transform 0.25s ease;
                    color: #f97316;
                    margin-left: auto;
                    flex-shrink: 0;
                }

                /* ── Meta footer ──────────────────────────────────────────── */
                .vr-overlay-meta {
                    display: flex;
                    gap: 2rem;
                    padding-top: 1.5rem;
                    border-top: 1px solid rgba(255,255,255,0.06);
                    flex-wrap: wrap;
                }
                .vr-meta-col { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; min-width: 130px; }
                .vr-meta-col--right { align-items: flex-end; text-align: right; }

                .vr-meta-heading {
                    font-size: 0.6rem !important;
                    font-weight: 500 !important;
                    letter-spacing: 0.12em !important;
                    text-transform: uppercase !important;
                    color: rgba(255,255,255,0.18) !important;
                    margin-bottom: 0.3rem;
                }
                .vr-meta-link {
                    font-size: 0.78rem;
                    color: rgba(255,255,255,0.4) !important;
                    text-decoration: none;
                    text-transform: none !important;
                    letter-spacing: 0 !important;
                    font-weight: 400;
                    line-height: 1.85;
                    transition: color 0.2s;
                }
                .vr-meta-link:hover { color: #f97316 !important; }

                .vr-meta-user {
                    font-size: 0.75rem;
                    color: rgba(255,255,255,0.28) !important;
                    text-transform: none !important;
                    letter-spacing: 0 !important;
                    margin-top: 0.4rem;
                }
                .vr-meta-user span { color: #f97316 !important; font-weight: 600; }

                .vr-meta-tag {
                    font-size: 0.7rem;
                    color: rgba(255,255,255,0.16) !important;
                    text-transform: none !important;
                    letter-spacing: 0 !important;
                    font-weight: 400;
                    line-height: 1.7;
                }
                .vr-meta-tag--orange { color: rgba(249,115,22,0.4) !important; }

                /* ── Mobile ───────────────────────────────────────────────── */
                @media (max-width: 640px) {
                    .vr-topbar      { padding: 0.9rem 1.25rem; }
                    .vr-overlay-bar { padding: 0.9rem 1.25rem; }
                    .vr-overlay-body { padding: 1.25rem 1.25rem 2rem; }
                    .vr-profile-name { display: none; }
                    .vr-meta-col--right { align-items: flex-start; text-align: left; }
                }
            `}</style>
        </div>
    );
}