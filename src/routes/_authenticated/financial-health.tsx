import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ShieldCheck, TriangleAlert } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAllData } from "@/lib/queries";
import { financialHealth } from "@/lib/financial-health";

export const Route = createFileRoute("/_authenticated/financial-health")({
  head: () => ({ meta: [{ title: "Financial Health — Wealthpilot" }] }),
  component: FinancialHealthPage,
});

function FinancialHealthPage() {
  const { user } = useAuth();
  const ctx = useAllData(user?.id);
  if (ctx.loading) return <div className="pt-20 text-center text-muted-foreground">Calculating your financial health…</div>;

  const health = financialHealth(ctx);
  const toneClass = (tone: string) => tone === "good" ? "text-emerald-300 bg-emerald-500/10" : tone === "watch" ? "text-warning bg-warning/10" : "text-destructive bg-destructive/10";

  return (
    <div className="space-y-6 pb-8">
      <header>
        <p className="text-sm text-muted-foreground">Explainable score</p>
        <h1 className="font-display text-3xl">Financial health</h1>
      </header>

      <section className="relative overflow-hidden rounded-3xl bg-hero p-6 shadow-elevated">
        <div className="absolute -right-10 -top-14 h-36 w-36 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative flex items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-accent"><ShieldCheck className="h-4 w-4" />Current score</div>
            <div className="mt-3 flex items-end gap-2"><span className="font-display text-6xl">{health.score}</span><span className="pb-2 text-sm text-muted-foreground">/ 100</span></div>
            <div className="mt-1 text-lg font-medium">{health.label}</div>
          </div>
          <div className="relative grid h-28 w-28 place-items-center rounded-full" style={{ background: `conic-gradient(hsl(var(--accent)) ${health.score * 3.6}deg, hsl(var(--secondary)) 0deg)` }}>
            <div className="grid h-20 w-20 place-items-center rounded-full bg-card text-2xl font-semibold">{health.score}</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="text-xs uppercase tracking-wider text-accent">Best next move</div>
        <p className="mt-2 text-base">{health.nextBestAction}</p>
        <Link to="/payday" className="mt-4 inline-flex items-center gap-1 text-sm text-accent">Use payday planner <ArrowRight className="h-4 w-4" /></Link>
      </section>

      <section className="space-y-3">
        {health.factors.map((factor) => {
          const pct = Math.round((factor.score / factor.max) * 100);
          return (
            <div key={factor.label} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {factor.tone === "good" ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <TriangleAlert className={`h-4 w-4 ${factor.tone === "watch" ? "text-warning" : "text-destructive"}`} />}
                    {factor.label}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{factor.detail}</p>
                </div>
                <div className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${toneClass(factor.tone)}`}>{factor.score}/{factor.max}</div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} /></div>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        This score is a practical progress indicator based on the information currently stored in Wealthpilot. It is not a credit score and does not replace professional financial advice.
      </section>
    </div>
  );
}
