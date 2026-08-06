import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Flag,
  Gauge,
  PauseCircle,
  RefreshCw,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { money } from "@/lib/format";
import { useGoals } from "@/lib/queries";
import type { Goal } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({
    meta: [
      { title: "Goals — Wealthpilot" },
      {
        name: "description",
        content: "Track active milestones, goal progress, and the next target worth funding.",
      },
    ],
  }),
  component: GoalsPage,
});

function GoalsPage() {
  const { user } = useAuth();
  const goalsQuery = useGoals(user?.id);
  const [showInactive, setShowInactive] = useState(false);
  const goals = goalsQuery.data ?? [];

  if (!user || goalsQuery.isLoading) return <GoalsSkeleton />;
  if (goalsQuery.error) return <GoalsError onRetry={() => void goalsQuery.refetch()} />;
  if (goals.length === 0) return <GoalsEmptyState />;

  const active = goals.filter((goal) => goal.active);
  const inactive = goals.filter((goal) => !goal.active);
  const activeTarget = active.reduce((sum, goal) => sum + Number(goal.target_amount), 0);
  const activeFunded = active.reduce((sum, goal) => sum + Number(goal.current_amount), 0);
  const activeProgress = activeTarget > 0 ? Math.min(100, (activeFunded / activeTarget) * 100) : 0;
  const remaining = Math.max(0, activeTarget - activeFunded);
  const completed = active.filter(
    (goal) =>
      Number(goal.target_amount) > 0 && Number(goal.current_amount) >= Number(goal.target_amount),
  ).length;
  const nextGoal = [...active]
    .filter((goal) => Number(goal.target_amount) > Number(goal.current_amount))
    .sort((a, b) => goalProgress(b) - goalProgress(a))[0];
  const nextRemaining = nextGoal
    ? Math.max(0, Number(nextGoal.target_amount) - Number(nextGoal.current_amount))
    : 0;

  return (
    <div className="space-y-7 pb-10 sm:space-y-8">
      <header className="pt-1">
        <div className="eyebrow">Goals · {active.length} active</div>
        <h1 className="mt-2 font-display text-[2.25rem] leading-none tracking-[-0.035em] sm:text-5xl">
          Turn progress into momentum.
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Keep the milestones that matter visible, know what is closest, and make the next
          contribution intentional.
        </p>
      </header>

      <section className="group relative overflow-hidden rounded-[2rem] border border-white/[0.11] bg-hero p-5 shadow-elevated sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/16 blur-3xl transition-transform duration-700 ease-out motion-safe:group-hover:scale-110" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-primary/18 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(17rem,0.8fr)] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.055] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-xl">
              <Target className="h-3.5 w-3.5 text-accent" /> Active goal portfolio
            </div>
            <div className="numeric-display mt-5 font-display text-[3.35rem] leading-none sm:text-7xl">
              {money(activeFunded)}
            </div>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
              Funded toward {money(activeTarget)} across active milestones. {money(remaining)}{" "}
              remains between today and every current target.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-2.5">
              <GoalMetric label="Active" value={String(active.length)} />
              <GoalMetric label="Complete" value={String(completed)} tone="text-success" />
              <GoalMetric
                label="Funded"
                value={`${Math.round(activeProgress)}%`}
                tone="text-accent"
              />
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-white/[0.09] bg-black/10 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-5">
              <GoalRing value={activeProgress} />
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Overall progress
                </div>
                <div className="mt-1 font-display text-2xl">
                  {Math.round(activeProgress)}% funded
                </div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  Across active targets only
                </div>
              </div>
            </div>
            <Progress value={activeProgress} className="mt-5 h-2 [&>*]:bg-accent" />
          </div>
        </div>
      </section>

      {nextGoal ? (
        <section className="relative overflow-hidden rounded-[1.7rem] border border-primary/20 bg-gradient-to-br from-primary/14 via-card to-card p-5 shadow-card sm:p-6">
          <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-primary/12 blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow flex items-center gap-2 text-primary-glow">
                  <Sparkles className="h-3.5 w-3.5" /> Next milestone
                </div>
                <h2 className="mt-2 font-display text-3xl tracking-[-0.02em]">{nextGoal.name}</h2>
              </div>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-[10px] font-semibold text-primary-glow">
                {Math.round(goalProgress(nextGoal))}%
              </span>
            </div>
            <div className="mt-5 flex items-end justify-between gap-5">
              <div>
                <div className="text-xs text-muted-foreground">Still needed</div>
                <div className="numeric-display mt-1 font-display text-3xl">
                  {money(nextRemaining)}
                </div>
              </div>
              <Button asChild className="rounded-2xl">
                <Link to="/payday">
                  Fund next pay <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      ) : active.length > 0 ? (
        <section className="rounded-[1.7rem] border border-success/20 bg-success/[0.07] p-5 shadow-card">
          <CheckCircle2 className="h-6 w-6 text-success" />
          <h2 className="mt-3 font-display text-2xl">Every active target is funded.</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            That is a good moment to review what milestone should earn the next dollar.
          </p>
        </section>
      ) : null}

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Milestones</div>
            <h2 className="mt-1 font-display text-2xl tracking-[-0.02em]">Active targets</h2>
          </div>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/scenario-planner">
              Test a scenario <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {active.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
          {active.length === 0 && (
            <div className="rounded-[1.5rem] border border-dashed border-border bg-card/35 p-6 text-sm text-muted-foreground lg:col-span-2">
              No goals are active right now. Your paused milestones are still preserved below.
            </div>
          )}
        </div>
      </section>

      {inactive.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowInactive((value) => !value)}
            className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-border bg-card/55 px-4 text-left transition hover:bg-card active:scale-[0.995]"
            aria-expanded={showInactive}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <PauseCircle className="h-4 w-4 text-muted-foreground" /> Paused goals
              <span className="text-xs font-normal text-muted-foreground">{inactive.length}</span>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showInactive ? "rotate-180" : ""}`}
            />
          </button>
          {showInactive && (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {inactive.map((goal) => (
                <GoalCard key={goal.id} goal={goal} muted />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/payday"
          className="group rounded-[1.65rem] border border-border bg-card p-5 shadow-card transition motion-safe:hover:-translate-y-0.5 motion-safe:hover:border-accent/25"
        >
          <Rocket className="h-5 w-5 text-accent" />
          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Next move
          </div>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h3 className="font-display text-2xl">Plan your next pay</h3>
            <ArrowRight className="mb-1 h-5 w-5 text-accent transition-transform group-hover:translate-x-1" />
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Protect obligations first, then decide what a goal can receive.
          </p>
        </Link>

        <Link
          to="/scenario-planner"
          className="group rounded-[1.65rem] border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-card transition motion-safe:hover:-translate-y-0.5 motion-safe:hover:border-primary/25"
        >
          <Gauge className="h-5 w-5 text-primary-glow" />
          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            What if?
          </div>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h3 className="font-display text-2xl">Test the trade-off</h3>
            <ArrowRight className="mb-1 h-5 w-5 text-primary-glow transition-transform group-hover:translate-x-1" />
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Compare a bigger contribution against the rest of your financial plan.
          </p>
        </Link>
      </section>
    </div>
  );
}

function goalProgress(goal: Goal) {
  const target = Number(goal.target_amount);
  const current = Number(goal.current_amount);
  return target > 0 ? Math.min(100, (current / target) * 100) : 0;
}

function GoalMetric({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-3.5 backdrop-blur-xl">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className={`numeric-display mt-1.5 font-display text-xl sm:text-2xl ${tone}`}>
        {value}
      </div>
    </div>
  );
}

function GoalRing({ value }: { value: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;
  return (
    <div
      className="relative h-24 w-24 shrink-0"
      aria-label={`${Math.round(value)} percent of active goals funded`}
      role="img"
    >
      <svg className="h-full w-full -rotate-90" viewBox="0 0 96 96" aria-hidden="true">
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          className="text-white/[0.07]"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-accent transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-xl">
        {Math.round(value)}%
      </div>
    </div>
  );
}

function GoalCard({ goal, muted }: { goal: Goal; muted?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const target = Number(goal.target_amount);
  const current = Number(goal.current_amount);
  const pct = goalProgress(goal);
  const remaining = Math.max(0, target - current);
  const done = target > 0 && current >= target;

  return (
    <article
      className={`rounded-[1.55rem] border border-border bg-card/82 p-5 shadow-card ${muted ? "opacity-65" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            ) : (
              <Flag className="h-4 w-4 shrink-0 text-primary-glow" />
            )}
            <h3 className="truncate text-sm font-semibold">{goal.name}</h3>
          </div>
          <div className="mt-3 numeric-display font-display text-2xl">{money(current)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">of {money(target)} target</div>
        </div>
        <div
          className={`rounded-full border px-2.5 py-1.5 text-[10px] font-semibold ${done ? "border-success/20 bg-success/10 text-success" : "border-primary/20 bg-primary/10 text-primary-glow"}`}
        >
          {done ? "Funded" : `${Math.round(pct)}%`}
        </div>
      </div>

      <Progress
        value={pct}
        className={`mt-4 h-2 ${done ? "[&>*]:bg-success" : "[&>*]:bg-primary"}`}
      />
      <div className="mt-2 flex items-center justify-between gap-4 text-xs text-muted-foreground">
        <span>{done ? "Target reached" : `${money(remaining)} to go`}</span>
        {goal.notes && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex min-h-8 items-center gap-1 font-semibold text-foreground/75 hover:text-foreground"
            aria-expanded={expanded}
          >
            Details{" "}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>
      {goal.notes && expanded && (
        <p className="mt-3 border-t border-border/70 pt-3 text-xs leading-5 text-muted-foreground">
          {goal.notes}
        </p>
      )}
    </article>
  );
}

function GoalsSkeleton() {
  return (
    <div className="space-y-7 pb-10" aria-busy="true" aria-label="Loading goals">
      <div className="space-y-3 pt-1">
        <div className="skeleton-shimmer h-3 w-28 rounded-full bg-muted" />
        <div className="skeleton-shimmer h-10 w-72 max-w-[80vw] rounded-xl bg-muted" />
        <div className="skeleton-shimmer h-4 w-full max-w-lg rounded bg-muted" />
      </div>
      <div className="skeleton-shimmer h-72 rounded-[2rem] bg-card" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="skeleton-shimmer h-44 rounded-[1.55rem] bg-card" />
        <div className="skeleton-shimmer h-44 rounded-[1.55rem] bg-card" />
      </div>
    </div>
  );
}

function GoalsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[62vh] items-center justify-center pb-10">
      <div className="w-full max-w-lg rounded-[2rem] border border-destructive/20 bg-card p-6 text-center shadow-elevated sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle />
        </div>
        <div className="eyebrow mt-5 text-destructive">Goal data interrupted</div>
        <h1 className="mt-2 font-display text-3xl">Your milestones did not refresh.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          Wealthpilot could not load your goals. Your saved progress has not been changed.
        </p>
        <Button type="button" onClick={onRetry} className="mt-5 rounded-2xl">
          <RefreshCw /> Try again
        </Button>
      </div>
    </div>
  );
}

function GoalsEmptyState() {
  return (
    <div className="flex min-h-[62vh] items-center justify-center pb-10">
      <div className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 text-center shadow-elevated sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary-glow">
          <TrendingUp />
        </div>
        <div className="eyebrow mt-5">Goals</div>
        <h1 className="mt-2 font-display text-3xl">Give your progress a destination.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          Your financial milestones will live here once goals are added to your Wealthpilot plan.
        </p>
        <Button asChild variant="outline" className="mt-5 rounded-2xl">
          <Link to="/scenario-planner">
            Explore scenarios <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}
