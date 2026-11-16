"use client";

import { useState } from "react";
import Icon, { type IconName } from "@/components/Icon";

/* Auth screen. The submit logic is unchanged — it posts to
   /api/auth/login and redirects on success. Only the presentation is new. */

const POINTS: { icon: IconName; copy: string }[] = [
  { icon: "radar", copy: "Watch the channels you choose, not a discovery feed." },
  { icon: "scissors", copy: "Every candidate arrives scored, with the reasons attached." },
  { icon: "check", copy: "Nothing renders or exports without your approval." },
];

/** "code" = shared access code (no database needed). "account" = email + password. */
type Mode = "code" | "account";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("code");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode): void {
    setMode(next);
    setError(null);
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = mode === "code" ? { code } : { email, password };
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        const raw = data.error;
        setError(typeof raw === "string" ? raw : "login failed");
        return;
      }
      window.location.href = "/";
    } catch {
      setError("network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen">
      <div className="mx-auto grid min-h-screen w-full max-w-[1100px] items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16 lg:py-16">
        {/* ── Brand side ───────────────────────────────────────── */}
        <section className="order-2 lg:order-1">
          <div className="mb-5 flex items-center gap-3">
            <span
              className="grid h-10 w-10 place-items-center rounded-[11px] border border-[var(--red-line)] text-[13px] font-semibold text-white"
              style={{
                fontFamily: "Sora, Inter, sans-serif",
                background: "linear-gradient(160deg, rgba(225,6,0,0.55), rgba(120,4,0,0.25))",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.05) inset, 0 12px 30px -16px rgba(225,6,0,0.9)",
              }}
            >
              SE
            </span>
            <div>
              <p className="text-[13.5px] font-medium leading-tight text-[var(--text)]">Street Ethics</p>
              <p className="kicker mt-1 block">Clip Engine</p>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-[2px] w-7 rounded-full"
              style={{ background: "var(--red)", boxShadow: "0 0 12px rgba(225,6,0,0.7)" }}
            />
            <span className="kicker">Sign in</span>
          </div>

          <h1 className="hero-title-display text-[34px] leading-[1.04] text-[var(--text)] sm:text-[46px]">
            Catch the moment.
            <br />
            <span className="text-[var(--red-hi)]">Ship the clip.</span>
          </h1>
          <p className="mt-4 max-w-[46ch] text-[14px] leading-relaxed text-[var(--muted)]">
            One pipeline for monitoring, cutting, approving, and exporting. Start at the Command Center
            and work left to right.
          </p>

          <ul className="mt-7 space-y-3 border-t border-[var(--line)] pt-6">
            {POINTS.map((p) => (
              <li key={p.copy} className="flex items-start gap-3">
                <span className="mt-[1px] grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--line-2)] bg-white/[0.03] text-[var(--muted)]">
                  <Icon name={p.icon} size={14} />
                </span>
                <span className="text-[12.5px] leading-relaxed text-[var(--muted)]">{p.copy}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Form side ────────────────────────────────────────── */}
        <section className="order-1 lg:order-2">
          <div className="panel-3d p-6 sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold text-[var(--text)]">
                  {mode === "code" ? "Enter access code" : "Welcome back"}
                </h2>
                <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                  {mode === "code"
                    ? "One code, this household only."
                    : "Use your workspace account."}
                </p>
              </div>
              <span className="chip">shared workspace</span>
            </div>

            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === "code" ? (
                <label className="block">
                  <span className="label mb-1.5 block">Access code</span>
                  <input
                    type="password"
                    required
                    autoFocus
                    autoComplete="current-password"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    aria-invalid={error ? true : undefined}
                    className="field"
                    placeholder="word-word-word-000"
                    spellCheck={false}
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <span className="mt-1.5 block text-[11px] leading-relaxed text-[var(--faint)]">
                    Case-sensitive. Paste it exactly — it is stored in{" "}
                    <code className="text-[var(--muted)]">~/.clip-mvp-access-code.txt</code> on the Mac
                    that set it up.
                  </span>
                </label>
              ) : (
                <>
                  <label className="block">
                    <span className="label mb-1.5 block">Email</span>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={error ? true : undefined}
                      className="field"
                      placeholder="you@studio.com"
                    />
                  </label>

                  <label className="block">
                    <span className="label mb-1.5 block">Password</span>
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-invalid={error ? true : undefined}
                      className="field"
                      placeholder="••••••••"
                    />
                  </label>
                </>
              )}

              {error ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-[var(--red-line)] bg-[var(--red-soft)] px-3 py-2.5"
                >
                  <Icon name="info" size={14} className="mt-[1px] shrink-0 text-[var(--red-hi)]" />
                  <p className="text-[12px] leading-relaxed text-[#ffb4b0]">{error}</p>
                </div>
              ) : null}

              <button type="submit" disabled={busy} className="btn btn-primary w-full">
                {busy ? "Checking…" : mode === "code" ? "Unlock" : "Sign in"}
                {busy ? null : <Icon name="arrow" size={15} />}
              </button>
            </form>

            <button
              type="button"
              onClick={() => switchMode(mode === "code" ? "account" : "code")}
              className="mt-4 w-full text-center text-[11.5px] text-[var(--muted)] underline decoration-[var(--line-2)] underline-offset-4 transition-colors hover:text-[var(--text)]"
            >
              {mode === "code" ? "Use email + password instead" : "Use the access code instead"}
            </button>

            <div className="mt-5 border-t border-[var(--line)] pt-4">
              <p className="text-[11px] leading-relaxed text-[var(--faint)]">
                The gate covers every page and every API route. Sessions last 7 days, then ask for the
                code again.
              </p>
            </div>
          </div>

          <p className="mt-4 px-1 text-[11px] leading-relaxed text-[var(--faint)]">
            Nothing on the other side of this gate is fabricated. Uploads, cuts, and renders are real
            records in this workspace; any stage that is not wired says so on its own screen.
          </p>
        </section>
      </div>
    </main>
  );
}
