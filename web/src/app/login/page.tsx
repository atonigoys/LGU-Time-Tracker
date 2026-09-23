"use client";

import { FormEvent, useEffect, useState } from "react";
import { call } from "@/lib/api";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inter } from "next/font/google";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  QrCode,
  Clock,
  Building2,
  Users,
  Loader2,
} from "lucide-react";
import { useSession, homeForRole } from "@/lib/session";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// Scoped to this page only, per the brand spec - not wired into the shared Tailwind theme.
const BRAND = {
  primary: "#0B5D2A",
  dark: "#063B1B",
  secondary: "#16803C",
  light: "#EAF6EE",
  bg: "#F5F7F6",
  text: "#17211B",
  muted: "#66736B",
  border: "#DDE5DF",
};

const FEATURES = [
  { icon: QrCode, label: "QR-based attendance" },
  { icon: Clock, label: "Real-time daily time record" },
  { icon: Users, label: "Built for LGU offices" },
];

export default function LoginPage() {
  const { session, loading, login } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showForgotInfo, setShowForgotInfo] = useState(false);

  useEffect(() => {
    // Apps Script sleeps when idle and the first request can take 10s+.
    // Wake it now so it's ready by the time the user submits the form.
    call("ping").catch(() => {});
  }, []);

  useEffect(() => {
    if (loading || !session) return;
    // A brief "Login successful" beat only when we just submitted the form;
    // visiting /login while already authenticated redirects immediately.
    const delay = success ? 250 : 0;
    const t = setTimeout(() => router.replace(homeForRole(session.user.role)), delay);
    return () => clearTimeout(t);
  }, [loading, session, success, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password, rememberMe);
      setSuccess(true);
      // redirect handled by the effect above once session updates
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please check your email and password.");
      setBusy(false);
    }
  }

  return (
    <div className={`${inter.variable} min-h-screen font-[family-name:var(--font-inter)]`} style={{ background: BRAND.bg }}>
      <div className="flex min-h-screen flex-col md:flex-row">
        {/* ---------- Left: brand panel ---------- */}
        <div
          className="animate-fade-in relative flex flex-col justify-between overflow-hidden px-8 py-8 text-white md:w-1/2 md:px-14 md:py-12"
          style={{ background: `linear-gradient(150deg, ${BRAND.primary} 0%, ${BRAND.dark} 100%)` }}
        >
          {/* decorative layers - subtle, low-opacity, purely presentational */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
              style={{ background: BRAND.secondary }}
            />
            <div
              className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full opacity-15 blur-3xl"
              style={{ background: "#FFFFFF" }}
            />
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
            <QrCode className="absolute top-10 right-10 opacity-[0.08] max-md:hidden" size={140} strokeWidth={1} />
            <Clock className="absolute bottom-24 right-16 opacity-[0.08] max-md:hidden" size={110} strokeWidth={1} />
            <Building2 className="absolute -bottom-6 left-1/3 opacity-[0.07] max-md:hidden" size={170} strokeWidth={1} />
          </div>

          <div className="relative z-10">
            <Image
              src="/logo.png"
              alt="LGU Time Tracker"
              width={100}
              height={100}
              priority
              className="h-[76px] w-[76px] md:h-[100px] md:w-[100px]"
            />
          </div>

          <div className="relative z-10 max-w-md">
            <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-[34px]">LGU TIME TRACKER</h1>
            <p className="mt-2.5 text-[15px] font-medium text-white/90">
              Employee Attendance &amp; Daily Time Record System
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              A secure digital attendance system for LGU employees.
            </p>

            <ul className="mt-8 hidden flex-col gap-3 md:flex">
              {FEATURES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-sm text-white/85">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Icon size={15} strokeWidth={2} />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative z-10 hidden text-xs text-white/50 md:block">
            &copy; 2026 LGU Time Tracker — Employee Attendance &amp; Daily Time Record System
          </div>
        </div>

        {/* ---------- Right: login panel ---------- */}
        <div className="flex flex-1 items-center justify-center bg-white px-5 py-10 md:px-12">
          <div className="animate-card-in w-[94%] max-w-[400px] sm:w-full">
            <Image
              src="/logo.png"
              alt="LGU Time Tracker"
              width={90}
              height={90}
              className="mx-auto mb-5 h-[75px] w-[75px] md:hidden"
            />

            <h2 className="text-[26px] font-bold" style={{ color: BRAND.text }}>
              Welcome Back
            </h2>
            <p className="mt-1.5 text-sm" style={{ color: BRAND.muted }}>
              Sign in to access your LGU Time Tracker account.
            </p>

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="mt-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
              >
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">Unable to sign in</div>
                  <div className="mt-0.5 text-[13px] text-red-600">{error}</div>
                </div>
              </div>
            )}

            {success && !error && (
              <div className="mt-5 flex items-center gap-2.5 rounded-lg border border-green-200 bg-green-50 px-3.5 py-3 text-sm text-green-700">
                <CheckCircle2 size={17} className="shrink-0" />
                <span className="font-semibold">Login successful — redirecting…</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" aria-hidden={success}>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-[13.5px] font-semibold" style={{ color: BRAND.text }}>
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" style={{ color: BRAND.muted }} />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="you@lgu.local"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy || success}
                    className="w-full rounded-[9px] border py-3 pr-3.5 pl-10.5 text-[14.5px] transition-all duration-150 outline-none focus:ring-4 disabled:opacity-60"
                    style={
                      {
                        borderColor: BRAND.border,
                        color: BRAND.text,
                        "--tw-ring-color": "rgba(11,93,42,0.12)",
                      } as React.CSSProperties
                    }
                    onFocus={(e) => (e.currentTarget.style.borderColor = BRAND.primary)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = BRAND.border)}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className="block text-[13.5px] font-semibold" style={{ color: BRAND.text }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotInfo((v) => !v)}
                    className="text-[12.5px] font-semibold hover:underline"
                    style={{ color: BRAND.primary }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" style={{ color: BRAND.muted }} />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy || success}
                    className="w-full rounded-[9px] border py-3 pr-11 pl-10.5 text-[14.5px] transition-all duration-150 outline-none focus:ring-4 disabled:opacity-60"
                    style={
                      {
                        borderColor: BRAND.border,
                        color: BRAND.text,
                        "--tw-ring-color": "rgba(11,93,42,0.12)",
                      } as React.CSSProperties
                    }
                    onFocus={(e) => (e.currentTarget.style.borderColor = BRAND.primary)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = BRAND.border)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute top-1/2 right-3.5 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {showForgotInfo && (
                  <p className="mt-2 rounded-md px-3 py-2 text-[12.5px]" style={{ background: BRAND.light, color: BRAND.text }}>
                    Please contact your HR/system administrator to reset your password.
                  </p>
                )}
              </div>

              <label className="flex cursor-pointer items-center gap-2 pt-0.5 text-[13px]" style={{ color: BRAND.muted }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded"
                  style={{ accentColor: BRAND.primary }}
                />
                Remember me
              </label>

              <button
                type="submit"
                disabled={busy || success}
                className="flex w-full items-center justify-center gap-2 rounded-[9px] py-3.5 text-[14.5px] font-semibold text-white shadow-[0_4px_14px_rgba(11,93,42,0.25)] transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                style={{ background: busy || success ? BRAND.secondary : BRAND.primary }}
                onMouseEnter={(e) => {
                  if (!busy && !success) e.currentTarget.style.background = BRAND.dark;
                }}
                onMouseLeave={(e) => {
                  if (!busy && !success) e.currentTarget.style.background = BRAND.primary;
                }}
              >
                {busy ? (
                  <>
                    <Loader2 size={17} className="animate-spin" /> Signing in…
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <p className="mt-5 text-center text-[13.5px]" style={{ color: BRAND.muted }}>
              New employee?{" "}
              <Link href="/register" className="font-semibold hover:underline" style={{ color: BRAND.primary }}>
                Create an account
              </Link>
            </p>

            <div className="mt-6 flex items-center justify-center gap-1.5 text-[11.5px]" style={{ color: BRAND.muted }}>
              <ShieldCheck size={13} />
              Secure access • LGU Employee Attendance System
            </div>

            <div className="mt-6 text-center text-[11px] md:hidden" style={{ color: BRAND.muted }}>
              &copy; 2026 LGU Time Tracker
              <br />
              Employee Attendance &amp; Daily Time Record System
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes card-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
        .animate-card-in {
          animation: card-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in,
          .animate-card-in {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
