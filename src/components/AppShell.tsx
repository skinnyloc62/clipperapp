"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "./Icon";

/* App shell: one fixed rail on desktop, a drawer on mobile.
   Navigation is the only client state here — everything else is
   server-rendered content slides into <main>. */

type NavLink = { href: string; label: string; icon: IconName; hint: string };

const NAV: NavLink[] = [
  { href: "/", label: "Command Center", icon: "command", hint: "Pipeline at a glance" },
  { href: "/radar", label: "Live Radar", icon: "radar", hint: "Monitored channels" },
  { href: "/clips", label: "Clip Inbox", icon: "inbox", hint: "Detected moments" },
  { href: "/editor", label: "Editor", icon: "scissors", hint: "Cut and caption" },
  { href: "/approvals", label: "Approvals", icon: "check", hint: "Ship or reject" },
  { href: "/earnings", label: "Earnings", icon: "wallet", hint: "Payout ledger" },
  { href: "/settings", label: "Settings", icon: "settings", hint: "Sources and rules" },
];

function Brand() {
  return (
    <Link href="/" className="group flex items-center gap-3" aria-label="Street Ethics Clip Engine — home">
      <span
        className="grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--red-line)] text-[13px] font-semibold tracking-tight text-white"
        style={{
          fontFamily: "Sora, Inter, sans-serif",
          background: "linear-gradient(160deg, rgba(225,6,0,0.55), rgba(120,4,0,0.25))",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.05) inset, 0 10px 26px -14px rgba(225,6,0,0.9)",
        }}
      >
        SE
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-medium leading-tight text-[var(--text)]">
          Street Ethics
        </span>
        <span className="kicker mt-0.5 block">Clip Engine</span>
      </span>
    </Link>
  );
}

function NavList({ pathname, onNavigate, hosted }: { pathname: string; onNavigate?: () => void; hosted: boolean }) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-0.5">
      {(hosted ? NAV.filter((item) => item.href === "/clips") : NAV).map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            data-active={active}
            aria-current={active ? "page" : undefined}
            className="nav-item"
          >
            <Icon name={item.icon} size={18} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppShell({ children, hosted = false }: { children: React.ReactNode; hosted?: boolean }) {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  // Close on route change and trap the page while the drawer is open.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The auth screen owns the full viewport — no rail, no drawer.
  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="min-h-screen lg:pl-[252px]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-[13px] focus:font-medium focus:text-black"
      >
        Skip to content
      </a>

      {/* ── Desktop rail ─────────────────────────────────────── */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col border-r border-white/[0.06] px-4 py-5 lg:flex"
        style={{
          background: "linear-gradient(180deg, rgba(9,9,12,0.82), rgba(7,7,10,0.9))",
          backdropFilter: "blur(18px) saturate(130%)",
          WebkitBackdropFilter: "blur(18px) saturate(130%)",
        }}
      >
        <Brand />

        <div className="mt-7 flex-1 overflow-y-auto">
          <p className="label mb-2 px-1">Workspace</p>
          <NavList pathname={pathname} hosted={hosted} />
        </div>

        <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <div className="flex items-center gap-2">
            <span className="pulse-dot" aria-hidden="true" />
            <span className="text-[12px] font-medium text-[var(--text)]">{hosted ? "Published clip viewer" : "Running on this Mac"}</span>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--faint)]">
            {hosted ? "Approved videos are published from the owner's Mac. This site lets you watch and download them." :
              "Uploads, cuts, renders, and downloads are real files in this app's data folder."}
          </p>
          <Link
            href="/login"
            className="mt-3 flex items-center justify-between rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[12px] text-[var(--muted)] transition-colors hover:border-white/20 hover:text-[var(--text)]"
          >
            Account
            <Icon name="arrow" size={14} />
          </Link>
        </div>
      </aside>

      {/* ── Mobile bar ───────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/[0.06] px-4 lg:hidden"
        style={{
          background: "rgba(8,8,11,0.78)",
          backdropFilter: "blur(16px) saturate(130%)",
          WebkitBackdropFilter: "blur(16px) saturate(130%)",
        }}
      >
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label="Open navigation"
          className="btn h-9 w-9 !px-0"
        >
          <Icon name="menu" size={18} />
        </button>
      </header>

      {/* ── Mobile drawer ────────────────────────────────────── */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" id="mobile-nav">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/65 backdrop-blur-[2px]"
          />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col border-r border-white/10 bg-[#0a0a0d] px-4 py-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="btn h-9 w-9 !px-0"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="mt-7 flex-1 overflow-y-auto">
              <p className="label mb-2 px-1">Workspace</p>
              <NavList pathname={pathname} hosted={hosted} onNavigate={() => setOpen(false)} />
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <div className="flex items-center gap-2">
                <span className="pulse-dot" aria-hidden="true" />
                <span className="text-[12px] font-medium">{hosted ? "Published clip viewer" : "Running on this Mac"}</span>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--faint)]">
                {hosted ? "Watch approved videos published from the owner's Mac." : "Real files in this app's data folder."}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <main id="main" className="mx-auto w-full max-w-[1180px] px-5 pb-24 pt-8 sm:px-7 lg:px-10 lg:pt-10">
        {children}
      </main>
    </div>
  );
}
