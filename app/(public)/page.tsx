// import { LandingBackground } from '@/components/landing/LandingBackground';
// import { HeroSection } from '@/components/landing/HeroSection';
// import { AboutSection } from '@/components/landing/AboutSection';
// import { CategoriesSection } from '@/components/landing/CategoriesSection';
// import { EventsGrid } from '@/components/landing/EventsGrid';
// import { ScheduleSection } from '@/components/landing/ScheduleSection';
// import { QuoteSection } from '@/components/landing/QuoteSection';
// import { FooterSection } from '@/components/landing/FooterSection';

// export default function LandingPage() {
//   return (
//     <div className="relative z-10 bg-black">
//       <LandingBackground />
//       <HeroSection />
//       <AboutSection />
//       <CategoriesSection />
//       <EventsGrid />
//       <ScheduleSection />
//       <QuoteSection />
//       <FooterSection />
//     </div>
//   );
// }

"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Canvas } from "@react-three/fiber"
import { ACESFilmicToneMapping } from "three"
import { GizmoViewcube, GizmoViewport, OrbitControls, GizmoHelper } from "@react-three/drei"
import { Cubes } from "@/components/Cubes"

const TARGET_DATE = new Date("2026-04-22T00:00:00")

function useCountdown(target: Date) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hrs: 0, mins: 0, secs: 0 })
  useEffect(() => {
    function update() {
      const diff = Math.max(0, target.getTime() - Date.now())
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hrs: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
        secs: Math.floor((diff % 60000) / 1000),
      })
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [target])
  return timeLeft
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-3xl font-light text-white tabular-nums sm:text-4xl md:text-zinc-900">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-xs tracking-widest text-white/70 uppercase md:text-zinc-500">{label}</span>
    </div>
  )
}

function Divider() {
  return <div className="hidden h-10 w-px self-center bg-white/35 sm:block md:bg-zinc-300" />
}

export default function CubePage() {
  const { days, hrs, mins, secs } = useCountdown(TARGET_DATE)
  const { status } = useSession()
  const isAuthenticated = status === "authenticated"

  return (
    <div className="relative -mt-10 flex w-full min-h-dvh flex-col overflow-hidden pt-10 md:flex-row">

      {/* 3D Canvas — true full bleed */}
      <div className="absolute inset-0">
        <Canvas
          style={{ width: "100%", height: "100%" }}
          camera={{ position: [3.13, 2.56, 6.96], fov: 45 }}
          shadows
          gl={{ toneMapping: ACESFilmicToneMapping, toneMappingExposure: 0.05 }}
        >
          <color attach="background" args={["oklch(0.78 0.12 27)"]} />
          <fog attach="fog" args={["oklch(0.78 0.12 27)", 20, 60]} />
          <GizmoHelper>
            <GizmoViewcube />
            <GizmoViewport />
          </GizmoHelper>
          <OrbitControls makeDefault enableZoom={false} />
          <Cubes />
        </Canvas>
      </div>

      {/* White vignette only for medium and larger screens */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-[55%] pl-10 md:block"
        style={{
          background:
            "linear-gradient(to right, oklch(0.97 0.003 27 / 0.88) 0%, oklch(0.97 0.003 27 / 0.70) 45%, transparent 100%)",
        }}
      />

      {/* Text panel — left side, vertically centered */}
      <div className="relative z-10 flex w-full max-w-130 flex-col justify-center gap-8 px-6 py-8 sm:px-10 md:w-130 md:shrink-0 md:px-18 md:py-10">
        <div className="text-center md:text-left">
          <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-white/80 uppercase md:text-zinc-700">
            Coming Soon
          </p>
          <h1
            className="mb-4 text-[clamp(2.8rem,4vw,4rem)] font-bold leading-tight text-white md:text-zinc-900"
          >
            Vigyann<span className="text-orange-600">rang</span>
          </h1>
          <p className="text-base leading-relaxed text-white/80 md:text-zinc-600">
            The official platform for registrations, events, and everything in between.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 md:justify-start">
          <Link
            href="/events"
            className="px-6 py-3 font-semibold rounded-xl transition-all"
            style={{ background: "oklch(0.505 0.213 27.518)", color: "oklch(0.971 0.013 17.38)" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            Browse Events
          </Link>
          <Link
            href={isAuthenticated ? "/dashboard" : "/auth/login"}
            className="px-6 py-3 font-semibold rounded-xl border transition-colors"
            style={{
              background: "oklch(1 0 0 / 0.5)",
              color: "oklch(0.21 0.006 285.885)",
              borderColor: "oklch(0.92 0.004 286.32)",
              backdropFilter: "blur(8px)",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "oklch(1 0 0 / 0.72)")}
            onMouseLeave={e => (e.currentTarget.style.background = "oklch(1 0 0 / 0.5)")}
          >
            {isAuthenticated ? "My Events" : "Sign In"}
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 md:justify-start">
          <CountdownUnit value={days} label="Days" />
          <Divider />
          <CountdownUnit value={hrs} label="Hrs" />
          <Divider />
          <CountdownUnit value={mins} label="Mins" />
          <Divider />
          <CountdownUnit value={secs} label="Secs" />
        </div>
      </div>

    </div>
  )
}