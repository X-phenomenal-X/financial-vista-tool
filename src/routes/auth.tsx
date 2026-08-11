import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { seedOwnerData } from "@/lib/seed";
import {
  ArrowRight,
  BarChart3,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
} from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Wealthpilot" },
      { name: "description", content: "Sign in or create your private Wealthpilot account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;

        if (data.user) {
          try {
            await seedOwnerData(data.user.id);
          } catch (err) {
            console.warn("Initial data could not be seeded yet", err);
          }
        }

        if (!data.session) {
          toast.success("Account created. Check your email to confirm your account.");
          setMode("signin");
          return;
        }

        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }

      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      toast.error("Enter your email first.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth`,
    });

    if (error) toast.error(error.message);
    else toast.success("Password reset email sent.");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090714] text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-48 w-48 -translate-x-1/2 rounded-full bg-cyan-400/5 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.13),transparent_38%)]" />
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <section className="hidden lg:block">
          <div className="mb-10 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25">
              <span className="font-display text-lg font-semibold text-white">W</span>
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight text-white">Wealthpilot</div>
              <div className="text-xs text-white/50">Your private financial operating system</div>
            </div>
          </div>

          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-medium text-violet-200">
              <Sparkles className="h-3.5 w-3.5" />
              Smarter money decisions, every day
            </div>
            <h1 className="font-display text-5xl leading-[1.04] tracking-tight text-white xl:text-6xl">
              See your money clearly.
              <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                Move forward confidently.
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-white/60">
              Plan your paydays, eliminate high-interest debt, track every goal, and get direct
              guidance from one secure dashboard.
            </p>
          </div>

          <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
            {[
              { icon: WalletCards, label: "Debt plan", value: "Prioritized" },
              { icon: BarChart3, label: "Cash flow", value: "Visible" },
              { icon: TrendingUp, label: "Progress", value: "Measurable" },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-violet-400/30 hover:bg-white/[0.07]"
              >
                <Icon className="mb-5 h-5 w-5 text-violet-300" />
                <div className="text-xs text-white/45">{label}</div>
                <div className="mt-1 text-sm font-semibold text-white">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-7 flex items-center gap-5 text-xs text-white/45">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              Private by design
            </span>
            <span className="inline-flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-violet-300" />
              Secure account access
            </span>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25">
              <span className="font-display text-xl font-semibold text-white">W</span>
            </div>
            <div>
              <div className="font-display text-2xl text-white">Wealthpilot</div>
              <div className="text-xs text-white/45">private personal finance</div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.065] p-1 shadow-2xl shadow-black/40 backdrop-blur-2xl">
            <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/80 to-transparent" />
            <div className="rounded-[1.75rem] border border-white/5 bg-[#111020]/90 p-5 sm:p-7">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.2em] text-violet-300/80">
                    Secure access
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    {mode === "signin" ? "Welcome back" : "Create your account"}
                  </h2>
                  <p className="mt-1 text-sm text-white/45">
                    {mode === "signin"
                      ? "Your financial dashboard is ready."
                      : "Start building your financial plan."}
                  </p>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5">
                  <ShieldCheck className="h-5 w-5 text-emerald-300" />
                </div>
              </div>

              <div className="mb-6 grid grid-cols-2 rounded-2xl border border-white/10 bg-black/20 p-1">
                {(["signin", "signup"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMode(item)}
                    className={`relative min-h-11 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                      mode === item
                        ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/20"
                        : "text-white/45 hover:text-white/75"
                    }`}
                  >
                    {item === "signin" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm text-white/75">Email</Label>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-xl border-white/10 bg-white/[0.045] text-white placeholder:text-white/25 focus-visible:border-violet-400/60 focus-visible:ring-violet-400/20"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-white/75">Password</Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={resetPassword}
                        className="-my-2 -mr-2 min-h-11 px-2 py-2 text-xs font-medium text-violet-300 transition hover:text-violet-200"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      placeholder={
                        mode === "signin" ? "Enter your password" : "Create a secure password"
                      }
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 rounded-xl border-white/10 bg-white/[0.045] pr-12 text-white placeholder:text-white/25 focus-visible:border-violet-400/60 focus-visible:ring-violet-400/20"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-white/35 transition hover:bg-white/5 hover:text-white/75"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {mode === "signup" && (
                  <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.06] p-3">
                    <div className="flex items-start gap-2 text-xs leading-5 text-emerald-100/75">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      Your account is private and your financial data stays protected by your own
                      login.
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="group h-12 w-full rounded-xl bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition duration-300 hover:-translate-y-0.5 hover:shadow-violet-500/35"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Working…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      {mode === "signin" ? "Enter Wealthpilot" : "Create my account"}
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  )}
                </Button>
              </form>

              <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-white/35">
                <LockKeyhole className="h-3.5 w-3.5" />
                Encrypted sign-in powered by Supabase
              </div>
            </div>
          </div>

          <p className="mt-5 text-center text-xs leading-5 text-white/30">
            By continuing, you agree to keep your credentials private and use Wealthpilot for your
            own financial planning.
          </p>
        </section>
      </div>
    </main>
  );
}
