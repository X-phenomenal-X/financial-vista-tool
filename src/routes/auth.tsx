import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { seedOwnerData } from "@/lib/seed";

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
    <div className="min-h-screen bg-hero flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card/70 p-8 shadow-elevated backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-grad shadow-card">
            <span className="font-display text-xl font-semibold text-primary-foreground">W</span>
          </div>
          <div>
            <div className="font-display text-2xl">Wealthpilot</div>
            <div className="text-xs text-muted-foreground">private personal finance</div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-xl bg-secondary/60 p-1">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              mode === "signin" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Create account
          </button>
        </div>

        <h1 className="mb-1 text-lg font-semibold">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Sign in to your financial dashboard."
            : "Create a secure account using your email and password."}
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {mode === "signin" && (
            <button
              type="button"
              onClick={resetPassword}
              className="text-xs text-accent hover:underline"
            >
              Forgot password?
            </button>
          )}

          <Button type="submit" className="w-full bg-violet-grad" disabled={loading}>
            {loading ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your information is stored securely in your private Supabase account.
        </p>
      </div>
    </div>
  );
}
