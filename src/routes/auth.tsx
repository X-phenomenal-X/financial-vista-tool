import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { seedOwnerData } from "@/lib/seed";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Money Map" }, { name: "description", content: "Sign in to your private Money Map account." }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signupOpen, setSignupOpen] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/dashboard" }); });
    supabase.rpc("is_signup_open").then(({ data }) => setSignupOpen(data === true));
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/dashboard` } });
        if (error) throw error;
        if (data.user) { try { await seedOwnerData(data.user.id); } catch (err) { console.warn("seed", err); } }
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (err) { toast.error((err as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-hero flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card/70 p-8 shadow-elevated backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-grad shadow-card">
            <span className="font-display text-xl font-semibold text-primary-foreground">M</span>
          </div>
          <div>
            <div className="font-display text-2xl">Money Map</div>
            <div className="text-xs text-muted-foreground">private personal finance</div>
          </div>
        </div>
        <h1 className="mb-1 text-lg font-semibold">{mode === "signin" ? "Welcome back" : "Create the owner account"}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{mode === "signin" ? "Sign in to your dashboard." : signupOpen === false ? "Signups are closed — an owner already exists." : "This is a single-owner app. The first account becomes owner."}</p>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button type="submit" className="w-full bg-violet-grad" disabled={loading || (mode === "signup" && signupOpen === false)}>{loading ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}</Button>
        </form>
        <div className="mt-4 text-center text-sm">
          {mode === "signin"
            ? signupOpen !== false && <button className="text-accent hover:underline" onClick={() => setMode("signup")}>Need to create the owner account?</button>
            : <button className="text-accent hover:underline" onClick={() => setMode("signin")}>Have an account? Sign in</button>}
        </div>
      </div>
    </div>
  );
}