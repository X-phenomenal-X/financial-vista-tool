import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarCheck, CheckCircle2, CreditCard, Flag, ShieldCheck, WalletCards } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/monthly-review")({
  head: () => ({
    meta: [
      { title: "Monthly Financial Review — Wealthpilot" },
      { name: "description", content: "A guided monthly financial review using your saved Wealthpilot data." },
    ],
  }),
  component: MonthlyReviewPage,
});

type Account = { id: string; name: string; kind: string; balance: number | string };
type Debt = { id: string; name: string; balance: number | string; pending: number | string | null; apr: number | string | null; credit_limit: number | string | null };
type Goal = { id: string; name: string; current_amount: number | string; target_amount: number | string };
type Recurring = { id: string; name: string; amount: number | string; kind: string; is_active: boolean };

const CASH_KINDS = new Set(["chequing", "savings", "money_master", "cash"]);
const ASSET_KINDS = new Set(["chequing", "savings", "money_master", "cash", "investment", "rrsp", "tfsa", "fhsa"]);

function money(value: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
}

function MonthlyReviewPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    let cancelled = false;
    async function load(uid: string) {
      setLoading(true);
      const [a, d, g, r] = await Promise.all([
        supabase.from("accounts").select("id,name,kind,balance").eq("user_id", uid),
        supabase.from("debts").select("id,name,balance,pending,apr,credit_limit").eq("user_id", uid),
        supabase.from("goals").select("id,name,current_amount,target_amount").eq("user_id", uid),
        supabase.from("recurring_transactions").select("id,name,amount,kind,is_active").eq("user_id", uid).eq("is_active", true),
      ]);
      if (!cancelled) {
        setAccounts((a.data ?? []) as Account[]);
        setDebts((d.data ?? []) as Debt[]);
        setGoals((g.data ?? []) as Goal[]);
        setRecurring((r.data ?? []) as Recurring[]);
        const key = `wealthpilot-monthly-review:${uid}:${new Date().toISOString().slice(0, 7)}`;
        try { setChecked(JSON.parse(localStorage.getItem(key) ?? "{}")); } catch { setChecked({}); }
        setLoading(false);
      }
    }
    void load(userId);
    return () => { cancelled = true; };
  }, [user?.id]);

  const summary = useMemo(() => {
    const assets = accounts.filter((a) => ASSET_KINDS.has(a.kind)).reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const cash = accounts.filter((a) => CASH_KINDS.has(a.kind)).reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const debt = debts.reduce((sum, d) => sum + Number(d.balance || 0) + Number(d.pending || 0), 0);
    const subscriptions = recurring.filter((r) => r.kind === "subscription").reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const bills = recurring.filter((r) => r.kind !== "income" && r.kind !== "subscription").reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const highestApr = [...debts].sort((a, b) => Number(b.apr || 0) - Number(a.apr || 0))[0];
    const closestGoal = [...goals].sort((a, b) => {
      const ap = Number(a.target_amount || 0) > 0 ? Number(a.current_amount || 0) / Number(a.target_amount) : 0;
      const bp = Number(b.target_amount || 0) > 0 ? Number(b.current_amount || 0) / Number(b.target_amount) : 0;
      return bp - ap;
    })[0];
    return { assets, cash, debt, netWorth: assets - debt, subscriptions, bills, highestApr, closestGoal };
  }, [accounts, debts, goals, recurring]);

  const tasks = [
    { id: "balances", title: "Verify account balances", detail: "Confirm chequing, savings, investments, and retirement balances are current.", to: "/net-worth" },
    { id: "cards", title: "Verify card payments", detail: "Confirm recent payments posted and pending amounts are accurate.", to: "/debts" },
    { id: "bills", title: "Review upcoming bills", detail: "Check due dates, auto-pay status, and cash required before payday.", to: "/bill-calendar" },
    { id: "subscriptions", title: "Review subscriptions", detail: "Cancel, pause, or question anything that no longer provides value.", to: "/subscriptions" },
    { id: "goals", title: "Update goal progress", detail: "Record contributions and confirm your next monthly target.", to: "/goals" },
    { id: "forecast", title: "Check next 30 days", detail: "Review your lowest projected balance before optional spending.", to: "/cash-flow" },
  ];

  function toggle(id: string) {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    if (user?.id) {
      const key = `wealthpilot-monthly-review:${user.id}:${new Date().toISOString().slice(0, 7)}`;
      localStorage.setItem(key, JSON.stringify(next));
    }
  }

  const completed = tasks.filter((task) => checked[task.id]).length;

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-start gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-grad shadow-card"><CalendarCheck className="h-5 w-5 text-primary-foreground" /></div>
        <div>
          <h1 className="font-display text-2xl">Monthly Financial Review</h1>
          <p className="text-sm text-muted-foreground">A focused check-in to keep your data and decisions on track.</p>
        </div>
      </header>

      <section className="rounded-3xl bg-violet-grad p-5 text-primary-foreground shadow-card">
        <div className="text-xs uppercase tracking-[0.18em] opacity-80">Review progress</div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="font-display text-4xl">{completed}/{tasks.length}</div>
          <div className="text-sm opacity-80">{completed === tasks.length ? "Complete" : "Items checked"}</div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${(completed / tasks.length) * 100}%` }} /></div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Metric icon={WalletCards} label="Cash" value={loading ? "—" : money(summary.cash)} />
        <Metric icon={ShieldCheck} label="Net worth" value={loading ? "—" : money(summary.netWorth)} />
        <Metric icon={CreditCard} label="Total debt" value={loading ? "—" : money(summary.debt)} />
        <Metric icon={Flag} label="Recurring outflow" value={loading ? "—" : money(summary.bills + summary.subscriptions)} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-lg">This month’s focus</h2>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <p>{summary.highestApr ? `Highest-cost debt: ${summary.highestApr.name} at ${Number(summary.highestApr.apr || 0).toFixed(2)}% APR.` : "Add debt APRs to identify your highest-cost balance."}</p>
          <p>{summary.closestGoal ? `Closest goal: ${summary.closestGoal.name} at ${Math.min(100, Math.round((Number(summary.closestGoal.current_amount || 0) / Math.max(1, Number(summary.closestGoal.target_amount || 0))) * 100))}% complete.` : "Add a financial goal to track monthly progress."}</p>
          <p>Subscriptions currently represent about {money(summary.subscriptions)} per billing cycle based on saved recurring items.</p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg">Monthly checklist</h2>
        {tasks.map((task) => (
          <div key={task.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <button aria-label={`Mark ${task.title} complete`} onClick={() => toggle(task.id)} className="mt-0.5 shrink-0">
                <CheckCircle2 className={`h-5 w-5 ${checked[task.id] ? "text-success" : "text-muted-foreground"}`} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{task.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{task.detail}</div>
              </div>
              <Link to={task.to} className="shrink-0 text-accent"><ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        ))}
      </section>

      <p className="text-center text-[10px] text-muted-foreground">This review is read-only. Checklist progress is stored privately on this device.</p>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof WalletCards; label: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-card p-4"><Icon className="h-5 w-5 text-accent" /><div className="mt-2 text-xs text-muted-foreground">{label}</div><div className="font-display text-xl">{value}</div></div>;
}
