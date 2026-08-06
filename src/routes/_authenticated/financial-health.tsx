import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAllData } from "@/lib/queries";
import { financialHealth, type HealthFactor } from "@/lib/financial-health";

export const Route = createFileRoute("/_authenticated/financial-health")({
  head: () => ({
    meta: [
      { title: "Financial Health — Wealthpilot" },
      {
        name: "description",
        content:
          "Understand your financial health score, strongest signals, biggest gaps, and next best action.",
      },
    ],
  }),
  component: FinancialHealthPage,
});

const FACTOR_ROUTES: Record<string, { to: string; label: string }> = {
  "Cash buffer": { to: "/payday", label: "Protect your buffer" },
  "Credit utilization": { to: "/debts", label: "Review card balances" },
  "Payment readiness": { to: "/bill-calendar", label: "Review upcoming payments" },
  "High-interest debt load": { to: "/simulator", label: "Open payoff lab" },
  "Goal progress": { to: "/goals", label: "Review goals" },
};

function maskSensitiveDetail(detail: string, hidden: boolean) {
  if (!hidden) return detail;
  return detail.replace(/\$[\d,.]+/g, "••••••");
}

function toneClasses(tone: HealthFactor["tone"]) {
  if (tone === "good") {
    return {
      chip: "border-success/20 bg-success/10 text-success",
      bar: "bg-success",
      icon: "text-success",
    };
  }
  if (tone === "watch") {
    return {
      chip: "border-warning/20 bg-warning/10 text-warning",
      bar: "bg-warning",
      icon: "text-warning",
    };
  }
  return {
    chip: "border-destructive/20 bg-destructive/10 text-destructive",
    bar: "bg-destructive",
    icon: "text-destructive",
  };
}

function FinancialHealthPage() {
  const { user } = useAuth();
  const ctx = useAllData(user?.id);
  const [hideDetails, setHideDetails] = useState(false);

  if (!user || ctx.loading) return <FinancialHealthSkeleton />;

  if (ctx.error) {
    return <FinancialHealthError onRetry={() => void ctx.refetch()} />;
  }

  const health = financialHealth(ctx);
  const rankedFactors = [...health.factors].sort((a, b) => a.score / a.max - b.score / b.max);
  const weakest = rankedFactors[0];
  const strongest = [...health.factors].sort((a, b) => b.score / b.max - a.score / a.max)[0];
  const attentionCount = health.factors.filter((factor) => factor.tone !== "good").length;
  const strongCount = health.factors.length - attentionCount;
  const biggestUpside = Math.max(0, ...health.factors.map((factor) => factor.max - factor.score));
  const nextRoute = weakest
    ? (FACTOR_ROUTES[weakest.label] ?? { to: "/payday", label: "Open payday planner" })
    : { to: "/payday", label: "Open payday planner" };

  return (
    <div className="space-y-7 pb-10 sm:space-y-8">
      <header className="flex items-start justify-between gap-4 pt-1">
        <div className="min-w-0">
          <div className="eyebrow">Financial health · Explainable score</div>
          <h1 className="mt-2 font-display text-[2.25rem] leading-[0.98] tracking-[-0.035em] sm:text-5xl">
            See what is helping you—and what moves you forward.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Five live signals turn your saved money data into a practical progress check.
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setHideDetails((value) => !value)}
          aria-label={hideDetails ? "Show financial details" : "Hide financial details"}
          aria-pressed={hideDetails}
          className="mt-1 shrink-0 rounded-2xl"
        >
          {hideDetails ? <EyeOff /> : <Eye />}
        </Button>
      </header>

      <section className="group relative overflow-hidden rounded-[2rem] border border-white/[0.11] bg-hero p-5 shadow-elevated sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/18 blur-3xl transition-transform duration-700 ease-out motion-safe:group-hover:scale-110" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-primary/16 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="relative">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                <ShieldCheck className="h-4 w-4" /> Current position
              </div>
              <div className="mt-4 flex items-end gap-2">
                <span className="font-display text-6xl leading-none tracking-[-0.05em] sm:text-7xl">
                  {health.score}
                </span>
                <span className="pb-1.5 text-sm text-muted-foreground">/ 100</span>
              </div>
              <div className="mt-2 text-xl font-semibold">{health.label}</div>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                {attentionCount === 0
                  ? "Every tracked factor is currently in a healthy range. Keep the system steady."
                  : `${attentionCount} of ${health.factors.length} signals can still improve. Start with the highest-upside one.`}
              </p>
            </div>

            <div
              className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full p-2 sm:h-32 sm:w-32"
              style={{
                background: `conic-gradient(var(--accent) ${health.score * 3.6}deg, var(--secondary) 0deg)`,
              }}
              aria-label={`Financial health score ${health.score} out of 100`}
            >
              <div className="grid h-full w-full place-items-center rounded-full border border-white/10 bg-background/85 shadow-card backdrop-blur-xl">
                <Gauge className="h-7 w-7 text-accent sm:h-8 sm:w-8" />
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 border-t border-white/10 pt-5 sm:gap-3">
            <HealthMetric label="Strong" value={`${strongCount}/${health.factors.length}`} />
            <HealthMetric label="Needs focus" value={String(attentionCount)} />
            <HealthMetric label="Top upside" value={`+${biggestUpside} pts`} />
          </div>
        </div>
      </section>

      {weakest && (
        <section className="relative overflow-hidden rounded-[1.75rem] border border-accent/20 bg-accent/[0.07] p-5 shadow-card sm:p-6">
          <div className="absolute -right-12 -top-16 h-36 w-36 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              <Target className="h-4 w-4" /> Highest-impact focus
            </div>
            <div className="mt-3 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{weakest.label}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {maskSensitiveDetail(weakest.detail, hideDetails)}
                </p>
              </div>
              <div className="shrink-0 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                {weakest.score}/{weakest.max}
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/[0.07] bg-background/35 p-4">
              <div className="text-xs text-muted-foreground">Best next move</div>
              <p className="mt-1 text-sm font-medium leading-6">{health.nextBestAction}</p>
              <Link
                to={nextRoute.to}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:text-accent/80"
              >
                {nextRoute.label} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between gap-4 px-1">
          <div>
            <div className="eyebrow">Health signals</div>
            <h2 className="mt-1 font-display text-2xl">What is shaping your score</h2>
          </div>
          <Link
            to="/insights"
            className="hidden items-center gap-1 text-xs font-semibold text-accent sm:inline-flex"
          >
            Smart insights <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {rankedFactors.map((factor, index) => {
            const pct = Math.round((factor.score / factor.max) * 100);
            const styles = toneClasses(factor.tone);
            const isWeakest = index === 0;
            return (
              <article
                key={factor.label}
                className={`rounded-[1.5rem] border bg-card p-5 shadow-card transition-[border-color,transform,box-shadow] duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-elevated ${
                  isWeakest ? "border-warning/25" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {factor.tone === "good" ? (
                        <CheckCircle2 className={`h-4 w-4 ${styles.icon}`} />
                      ) : (
                        <TriangleAlert className={`h-4 w-4 ${styles.icon}`} />
                      )}
                      {factor.label}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {maskSensitiveDetail(factor.detail, hideDetails)}
                    </p>
                  </div>
                  <div
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${styles.chip}`}
                  >
                    {factor.score}/{factor.max}
                  </div>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full transition-[width] duration-700 ${styles.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <span>
                    {factor.tone === "good"
                      ? "Healthy"
                      : factor.tone === "watch"
                        ? "Watch"
                        : "Needs focus"}
                  </span>
                  <span>{pct}% of factor</span>
                </div>
              </article>
            );
          })}
        </div>

        <Link
          to="/insights"
          className="mt-3 inline-flex items-center gap-1.5 px-1 text-sm font-semibold text-accent sm:hidden"
        >
          Open smart insights <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {strongest && (
        <section className="flex items-start gap-3 rounded-[1.5rem] border border-success/15 bg-success/[0.06] p-4 sm:p-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success/10 text-success">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">Protect what is already working</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              <span className="font-medium text-foreground">{strongest.label}</span> is currently
              your strongest tracked signal. Keep it steady while you work on{" "}
              {weakest?.label.toLowerCase()}.
            </p>
          </div>
        </section>
      )}

      <p className="px-2 text-center text-[10px] leading-4 text-muted-foreground">
        Wealthpilot's health score is a deterministic progress indicator from your saved app data.
        It is not a credit score or a substitute for professional financial advice.
      </p>
    </div>
  );
}

function HealthMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/10 px-3 py-3 backdrop-blur-sm sm:px-4">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold sm:text-base">{value}</div>
    </div>
  );
}

function FinancialHealthSkeleton() {
  return (
    <div className="space-y-7 pb-10" aria-busy="true" aria-label="Calculating financial health">
      <div className="space-y-3 pt-1">
        <div className="h-3 w-40 animate-pulse rounded-full bg-muted" />
        <div className="h-10 w-4/5 animate-pulse rounded-2xl bg-muted sm:w-2/3" />
        <div className="h-4 w-3/5 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="h-72 animate-pulse rounded-[2rem] border border-border bg-card" />
      <div className="h-48 animate-pulse rounded-[1.75rem] border border-border bg-card" />
      <div className="grid gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-36 animate-pulse rounded-[1.5rem] border border-border bg-card"
          />
        ))}
      </div>
    </div>
  );
}

function FinancialHealthError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center pb-10">
      <div className="w-full rounded-[2rem] border border-destructive/25 bg-card p-6 text-center shadow-elevated sm:p-8">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <TriangleAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-3xl">Your health score could not be refreshed.</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          One or more live money sources did not load. Wealthpilot will not calculate a score from
          partial data.
        </p>
        <Button type="button" onClick={onRetry} className="mt-5 rounded-xl">
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      </div>
    </div>
  );
}
