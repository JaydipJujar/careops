import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
  CalendarDays,
  BarChart3,
} from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const user = await login(email, password);

        toast.success("Welcome back!");

        if (user.workspace_id) {
          navigate("/dashboard");
        } else {
          navigate("/onboarding");
        }
      } else {
        const user = await register(email, password);

        toast.success("Account created successfully!");
        navigate("/onboarding");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Authentication failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setEmail("");
    setPassword("");
    setShowPassword(false);
  };

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-900">
      {/* Decorative background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-violet-200/30 blur-3xl" />
      </div>

      <div className="relative min-h-screen flex flex-col">
        {/* Header */}
        <header className="w-full px-6 py-6 lg:px-10">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 shadow-lg">
                <Activity className="h-5 w-5 text-white" strokeWidth={2.5} />

                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-2 ring-[#f7f9fc]" />
              </div>

              <div>
                <div className="text-lg font-bold tracking-tight">
                  CareOps
                </div>
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                  Operations Platform
                </div>
              </div>
            </div>

            {/* Security badge */}
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-xs font-medium text-slate-500 shadow-sm backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Secure workspace
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex flex-1 items-center px-6 pb-12 pt-4 lg:px-10">
          <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_25px_80px_-25px_rgba(15,23,42,0.22)] lg:grid-cols-[1.05fr_0.95fr]">

            {/* LEFT — Brand / Product */}
            <section className="relative hidden overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:min-h-[680px] lg:flex-col lg:justify-between xl:p-14">

              {/* Grid */}
              <div
                className="absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)",
                  backgroundSize: "42px 42px",
                }}
              />

              {/* Glow */}
              <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-indigo-500/30 blur-3xl" />
              <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />

              <div className="relative z-10">
                <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2 text-xs font-medium text-slate-300 backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  Built for modern teams
                </div>

                <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight xl:text-5xl">
                  Run your operations.
                  <br />
                  <span className="text-indigo-400">
                    Not your paperwork.
                  </span>
                </h1>

                <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
                  CareOps brings bookings, contacts, forms, inventory,
                  communications and daily operations into one beautifully
                  organized workspace.
                </p>

                {/* Features */}
                <div className="mt-10 grid gap-4 sm:grid-cols-2">
                  <Feature
                    icon={<CalendarDays className="h-4 w-4" />}
                    title="Smart bookings"
                    text="Stay ahead of every appointment."
                  />

                  <Feature
                    icon={<Users className="h-4 w-4" />}
                    title="Contacts"
                    text="Keep every relationship organized."
                  />

                  <Feature
                    icon={<BarChart3 className="h-4 w-4" />}
                    title="Operations"
                    text="See what needs attention instantly."
                  />

                  <Feature
                    icon={<ShieldCheck className="h-4 w-4" />}
                    title="Secure"
                    text="Your workspace stays protected."
                  />
                </div>
              </div>

              {/* Bottom testimonial / status */}
              <div className="relative z-10 mt-12">
                <div className="border-t border-white/10 pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      <AvatarLetter letter="J" />
                      <AvatarLetter letter="A" />
                      <AvatarLetter letter="M" />
                    </div>

                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-amber-400">★★★★★</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Designed to keep your team moving.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* RIGHT — Auth */}
            <section className="flex min-h-[680px] items-center justify-center p-7 sm:p-10 lg:p-12 xl:p-16">
              <div className="w-full max-w-md">

                {/* Mobile logo */}
                <div className="mb-10 flex items-center gap-3 lg:hidden">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950">
                    <Activity className="h-5 w-5 text-white" />
                  </div>

                  <div>
                    <div className="font-bold">CareOps</div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-400">
                      Operations Platform
                    </div>
                  </div>
                </div>

                {/* Heading */}
                <div className="mb-9">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50">
                    {isLogin ? (
                      <LockKeyhole className="h-5 w-5 text-indigo-600" />
                    ) : (
                      <Building2 className="h-5 w-5 text-indigo-600" />
                    )}
                  </div>

                  <h2 className="text-3xl font-bold tracking-tight text-slate-950">
                    {isLogin ? "Welcome back" : "Create your workspace"}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {isLogin
                      ? "Sign in to continue to your CareOps workspace."
                      : "Get your operations organized in minutes."}
                  </p>
                </div>

                {/* Form */}
                <form
                  onSubmit={handleSubmit}
                  className="space-y-5"
                  data-testid="auth-form"
                >
                  {/* Email */}
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Email address
                    </label>

                    <div className="group relative">
                      <Mail className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-500" />

                      <input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        data-testid="email-input"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-11 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label
                        htmlFor="password"
                        className="block text-sm font-semibold text-slate-700"
                      >
                        Password
                      </label>

                      {isLogin && (
                        <button
                          type="button"
                          className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                          onClick={() =>
                            toast.info(
                              "Password reset can be connected to your backend."
                            )
                          }
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>

                    <div className="group relative">
                      <LockKeyhole className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-500" />

                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        data-testid="password-input"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-11 pr-12 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-[18px] w-[18px]" />
                        ) : (
                          <Eye className="h-[18px] w-[18px]" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Remember */}
                  {isLogin && (
                    <div className="flex items-center gap-2">
                      <div className="flex h-4 w-4 items-center justify-center rounded border border-slate-300">
                        <Check className="h-3 w-3 text-indigo-600" />
                      </div>
                      <span className="text-xs text-slate-500">
                        Secure session
                      </span>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    data-testid="submit-button"
                    className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition-all hover:-translate-y-0.5 hover:bg-indigo-600 hover:shadow-xl hover:shadow-indigo-600/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Please wait...
                      </>
                    ) : (
                      <>
                        {isLogin
                          ? "Sign in to CareOps"
                          : "Create workspace"}

                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="my-7 flex items-center gap-4">
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    {isLogin ? "New to CareOps?" : "Already a member?"}
                  </span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>

                {/* Switch */}
                <button
                  type="button"
                  onClick={switchMode}
                  data-testid="toggle-auth-mode"
                  className="flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-all hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700"
                >
                  {isLogin
                    ? "Create a free workspace"
                    : "Sign in to your workspace"}
                </button>

                {/* Footer */}
                <div className="mt-8 text-center">
                  <p className="text-[11px] leading-5 text-slate-400">
                    By continuing, you agree to CareOps' terms and
                    privacy policy.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </main>

        {/* Footer */}
        <footer className="px-6 pb-6 text-center">
          <p className="text-[11px] text-slate-400">
            © {new Date().getFullYear()} CareOps. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}

/* --------------------------------
   Small UI Components
--------------------------------- */

function Feature({ icon, title, text }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.07] text-indigo-400">
        {icon}
      </div>

      <div>
        <div className="text-sm font-semibold text-slate-200">
          {title}
        </div>

        <div className="mt-0.5 text-xs leading-5 text-slate-500">
          {text}
        </div>
      </div>
    </div>
  );
}

function AvatarLetter({ letter }) {
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-950 bg-slate-800 text-[9px] font-bold text-slate-300">
      {letter}
    </div>
  );
}