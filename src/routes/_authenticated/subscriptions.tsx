import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ChevronDown,
  CreditCard,
  Eye,
  EyeOff,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions — Wealthpilot" },
      {
        name: "description",
        content: "Understand recurring subscription cost, upcoming renewals, and the easiest places to trim spend.",
      },
    ],
  }),
  component: SubscriptionsPage,
});

type Subscription = {
  id: string;
  name: string;
  merchant: string | null;
  amount: number;
  cadence: "weekly" | "biweekly" | "semimonthly" | "monthly" | "quarterly" | "semiannual" | "annual" | "custom";
  next_due_date: string;
  category: string | null;
  autopay: boolean;
  is_active: boolean;
};

type Filter = "active" | "all" | "paused";

const monthlyFactor: Record<Subscription["cadence"], number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  semimonthly: 2,
  monthly: 1,
  quarterly: 1 / 3,
  semiannual: 1 / 6,
  annual: 1 / 12,
  custom: 1,
};

function daysUntilDate(date: string) {
  return Math.ceil((new Date(`${date}T12:00:00`).getTime() - Date.now()) / 86400000);
}

function renewalLabel(days: number) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Renews today";
  if (days === 1) return "Renews tomorrow";
  return `Renews in ${days}d`;
}

function SubscriptionsPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const db = supabase;
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("active");
  const [search, setSearch] = useState("");
  const [costMode, setCostMode] = useState<"monthly" | "annual">("monthly");
  const [showAmounts, setShowAmounts] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", amount: "", cadence: "monthly" as Subscription["cadence"], next_due_date: "", category: "Entertainment", autopay: true });

  const subscriptions = useQuery({
    queryKey: ["subscriptions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await db
        .from("recurring_transactions")
        .select("id,name,merchant,amount,cadence,next_due_date,category,autopay,is_active")
        .eq("kind", "subscription")
        .eq("user_id", user!.id)
        .order("next_due_date");
      if (error) throw error;
      return (data ?? []) as Subscription[];
    },
  });

  const createSubscription = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Please sign in again.");
      const amount = Number(form.amount);
      if (!form.name.trim() || !amount || amount < 0 || !form.next_due_date) throw new Error("Enter a name, amount, and next renewal date.");
      const { error } = await db.from("recurring_transactions").insert({
        user_id: user.id,
        name: form.name.trim(),
        merchant: form.name.trim(),
        amount,
        cadence: form.cadence,
        next_due_date: form.next_due_date,
        category: form.category.trim() || null,
        autopay: form.autopay,
        kind: "subscription",
        source: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subscription added");
      setForm({ name: "", amount: "", cadence: "monthly" as Subscription["cadence"], next_due_date: "", category: "Entertainment", autopay: true });
      setOpen(false);
      client.invalidateQueries({ queryKey: ["subscriptions", user?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await db.from("recurring_transactions").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.active ? "Subscription resumed" : "Subscription paused");
      client.invalidateQueries({ queryKey: ["subscriptions", user?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("recurring_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subscription removed");
      setDeleteId(null);
      client.invalidateQueries({ queryKey: ["subscriptions", user?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = useMemo(() => subscriptions.data ?? [], [subscriptions.data]);
  const active = rows.filter((item) => item.is_active);
  const monthly = useMemo(() => active.reduce((sum, item) => sum + Number(item.amount) * monthlyFactor[item.cadence], 0), [active]);
  const annual = monthly * 12;
  const nextSevenDays = active.filter((item) => {
    const days = daysUntilDate(item.next_due_date);
    return days >= 0 && days <= 7;
  });
  const topCategory = useMemo(() => {
    const totals = new Map<string, number>();
    active.forEach((item) => {
      const category = item.category || "Uncategorized";
      totals.set(category, (totals.get(category) || 0) + Number(item.amount) * monthlyFactor[item.cadence]);
    });
    return [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "None yet";
  }, [active]);
  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    active.forEach((item) => {
      const category = item.category || "Uncategorized";
      totals.set(category, (totals.get(category) || 0) + Number(item.amount) * monthlyFactor[item.cadence]);
    });
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [active]);
  const largestSubscription = useMemo(
    () => [...active].sort((a, b) => Number(b.amount) * monthlyFactor[b.cadence] - Number(a.amount) * monthlyFactor[a.cadence])[0],
    [active],
  );
  const largestMonthlyCost = largestSubscription ? Number(largestSubscription.amount) * monthlyFactor[largestSubscription.cadence] : 0;
  const topCategoryMonthly = categoryTotals[0]?.[1] || 0;
  const topCategoryShare = monthly > 0 ? Math.round((topCategoryMonthly / monthly) * 100) : 0;
  const manualRenewalsSoon = nextSevenDays.filter((item) => !item.autopay).length;

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((item) => {
      const matchesFilter = filter === "all" || (filter === "active" ? item.is_active : !item.is_active);
      const matchesSearch = !query || item.name.toLowerCase().includes(query) || (item.category || "").toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [filter, rows, search]);

  if (subscriptions.isLoading) {
    return (
      <div className="space-y-5 pb-8">
        <div className="h-12 animate-pulse rounded-2xl bg-secondary/60" />
        <div className="h-72 animate-pulse rounded-3xl bg-secondary/50" />
        <div className="grid grid-cols-2 gap-3"><div className="h-24 animate-pulse rounded-2xl bg-secondary/40" /><div className="h-24 animate-pulse rounded-2xl bg-secondary/40" /></div>
        <div className="h-40 animate-pulse rounded-3xl bg-secondary/40" />
      </div>
    );
  }

  if (subscriptions.error) {
    return (
      <div className="mx-auto flex min-h-[62vh] max-w-lg items-center justify-center py-10">
        <div className="w-full rounded-[2rem] border border-destructive/20 bg-card p-6 text-center shadow-elevated sm:p-8">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive"><AlertTriangle className="h-6 w-6" /></div>
          <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-destructive">Subscriptions unavailable</div>
          <h1 className="mt-2 font-display text-3xl">Recurring spend did not refresh</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Wealthpilot could not load your subscription records. Nothing has been changed or removed.</p>
          <Button className="mt-6 w-full rounded-2xl sm:w-auto" onClick={() => void subscriptions.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button>
        </div>
      </div>
    );
  }

  const displayMoney = (value: number) => showAmounts ? money(value) : "••••";

  return (
    <div className="space-y-7 pb-10 sm:space-y-8">
      <header className="flex items-start justify-between gap-4 pt-1">
        <div className="min-w-0">
          <div className="eyebrow">Recurring spend · {active.length} active</div>
          <h1 className="mt-2 font-display text-[2.25rem] leading-[0.98] tracking-[-0.035em] sm:text-5xl">Keep the useful. Cut the drift.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">See what renews next, where recurring cost clusters, and the easiest spend to reconsider.</p>
        </div>
        <Button size="icon" className="mt-1 shrink-0 rounded-2xl bg-violet-grad shadow-card" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close add subscription form" : "Add subscription"}>
          {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </Button>
      </header>

      <section className="group relative overflow-hidden rounded-[2rem] border border-white/[0.11] bg-hero p-5 shadow-elevated sm:p-7 lg:p-8">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-20 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground"><Sparkles className="h-4 w-4 text-accent" />Recurring cost</div>
            <div className="flex items-center gap-2"><button type="button" onClick={() => setShowAmounts((value) => !value)} className="grid h-9 w-9 place-items-center rounded-full border border-border/70 bg-background/40 text-muted-foreground backdrop-blur" aria-label={showAmounts ? "Hide subscription costs" : "Show subscription costs"}>{showAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button><div className="flex rounded-full border border-border/70 bg-background/40 p-1 text-xs backdrop-blur">
              {(["monthly", "annual"] as const).map((mode) => (
                <button key={mode} onClick={() => setCostMode(mode)} className={`rounded-full px-3 py-1.5 capitalize transition ${costMode === mode ? "bg-foreground text-background shadow-sm" : "text-muted-foreground"}`}>{mode}</button>
              ))}
            </div></div>
          </div>
          <div className="mt-4 font-display text-5xl tabular-nums tracking-tight">{displayMoney(costMode === "monthly" ? monthly : annual)}</div>
          <div className="mt-2 text-sm text-muted-foreground">{costMode === "monthly" ? `${displayMoney(annual)} committed per year` : `${displayMoney(monthly)} average per month`}</div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/5 bg-background/35 p-3 backdrop-blur"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Active</div><div className="mt-1 font-display text-2xl">{active.length}</div></div>
            <div className="rounded-2xl border border-white/5 bg-background/35 p-3 backdrop-blur"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">This week</div><div className="mt-1 font-display text-2xl">{nextSevenDays.length}</div></div>
            <div className="rounded-2xl border border-white/5 bg-background/35 p-3 backdrop-blur"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Top category</div><div className="mt-1 truncate text-sm font-semibold">{topCategory}</div></div>
          </div>
          <div className="mt-5 rounded-2xl border border-white/[0.08] bg-background/30 p-3.5 backdrop-blur">
            <div className="flex items-start gap-3"><TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-success" /><div><div className="text-sm font-semibold">Fastest trim: {largestSubscription?.name || "add your first subscription"}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{largestSubscription ? `Your largest recurring service is ${displayMoney(largestMonthlyCost)}/mo (${displayMoney(largestMonthlyCost * 12)}/yr). Pause it in one tap if it is no longer earning its place.` : "Once subscriptions are saved, Wealthpilot will surface the highest-impact place to review."}</p></div></div>
          </div>
        </div>
      </section>

      {active.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-card"><div className="flex items-center justify-between"><div><div className="eyebrow">Spend concentration</div><h2 className="mt-2 font-semibold">{topCategory}</h2></div><div className="font-display text-3xl text-accent">{topCategoryShare}%</div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${topCategoryShare}%` }} /></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{displayMoney(topCategoryMonthly)} of your normalized monthly subscription spend sits here.</p></div>
          <div className={`rounded-3xl border p-5 shadow-card ${manualRenewalsSoon > 0 ? "border-warning/25 bg-warning/8" : "border-border bg-card"}`}><div className="flex items-center justify-between"><div><div className="eyebrow">Next 7 days</div><h2 className="mt-2 font-semibold">Renewal attention</h2></div><CalendarClock className={`h-6 w-6 ${manualRenewalsSoon > 0 ? "text-warning" : "text-success"}`} /></div><div className="mt-4 font-display text-3xl">{nextSevenDays.length}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{manualRenewalsSoon > 0 ? `${manualRenewalsSoon} upcoming renewal${manualRenewalsSoon === 1 ? " is" : "s are"} manual.` : nextSevenDays.length ? "Every upcoming renewal is on auto-pay." : "No subscription charges are expected this week."}</p></div>
        </section>
      )}

      {nextSevenDays.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold">Renewing soon</h2><p className="text-xs text-muted-foreground">Charges expected within seven days</p></div><CalendarClock className="h-5 w-5 text-warning" /></div>
          <div className="flex snap-x gap-3 overflow-x-auto pb-2">
            {nextSevenDays.map((item) => {
              const days = daysUntilDate(item.next_due_date);
              return (
                <button key={item.id} onClick={() => setExpandedId(item.id)} className="min-w-[76%] snap-start rounded-3xl border border-warning/20 bg-warning/5 p-4 text-left transition hover:border-warning/40 active:scale-[0.98] sm:min-w-[45%]">
                  <div className="flex items-center justify-between gap-3"><div className="truncate font-semibold">{item.name}</div><div className="font-display text-lg">{displayMoney(Number(item.amount))}</div></div>
                  <div className="mt-3 flex items-center justify-between text-xs"><span className="rounded-full bg-warning/15 px-2 py-1 text-warning">{renewalLabel(days)}</span><span className="text-muted-foreground">{item.autopay ? "Auto-pay" : "Manual"}</span></div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {open && (
        <section className="overflow-hidden rounded-3xl border border-accent/25 bg-card shadow-elevated">
          <div className="border-b border-border bg-gradient-to-r from-accent/10 to-transparent px-5 py-4"><div className="flex items-center gap-2"><Zap className="h-4 w-4 text-accent" /><h2 className="font-semibold">Add a subscription</h2></div><p className="mt-1 text-xs text-muted-foreground">Track the real monthly and yearly cost before the next renewal.</p></div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div><Label>Name</Label><Input className="mt-1 rounded-xl" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Spotify" /></div>
            <div><Label>Amount</Label><Input className="mt-1 rounded-xl" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="12.99" /></div>
            <div><Label>Cadence</Label><select className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value as Subscription["cadence"] })}><option value="monthly">Monthly</option><option value="annual">Annual</option><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="quarterly">Quarterly</option><option value="semiannual">Every 6 months</option></select></div>
            <div><Label>Next renewal</Label><Input className="mt-1 rounded-xl" type="date" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} /></div>
            <div><Label>Category</Label><Input className="mt-1 rounded-xl" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <label className="flex items-center justify-between rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-sm"><span><span className="block font-medium">Auto-pay</span><span className="text-xs text-muted-foreground">Charge happens automatically</span></span><input className="h-4 w-4 accent-current" type="checkbox" checked={form.autopay} onChange={(e) => setForm({ ...form, autopay: e.target.checked })} /></label>
          </div>
          <div className="border-t border-border p-4"><Button className="w-full rounded-2xl bg-violet-grad" disabled={createSubscription.isPending} onClick={() => createSubscription.mutate()}>{createSubscription.isPending ? "Saving…" : "Save subscription"}</Button></div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex rounded-2xl border border-border bg-card p-1">
            {(["active", "all", "paused"] as const).map((value) => (
              <button key={value} onClick={() => setFilter(value)} className={`flex-1 rounded-xl px-3 py-2 text-xs capitalize transition sm:flex-none ${filter === value ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground"}`}>{value}</button>
            ))}
          </div>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="rounded-2xl pl-9" placeholder="Search subscriptions" /></div>
        </div>

        {visibleRows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary"><CreditCard className="h-6 w-6 text-accent" /></div>
            <h3 className="mt-4 font-semibold">Nothing to show</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">Add a recurring service or change the filters to see subscriptions already saved.</p>
            <Button className="mt-5 rounded-2xl" variant="secondary" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Add subscription</Button>
          </div>
        ) : visibleRows.map((item) => {
          const monthlyCost = Number(item.amount) * monthlyFactor[item.cadence];
          const days = daysUntilDate(item.next_due_date);
          const expanded = expandedId === item.id;
          const urgent = item.is_active && days <= 3;
          return (
            <article key={item.id} className={`group overflow-hidden rounded-3xl border bg-card shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elevated ${urgent ? "border-warning/35" : "border-border"} ${item.is_active ? "" : "opacity-65"}`}>
              <button className="w-full p-5 text-left" onClick={() => setExpandedId(expanded ? null : item.id)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${urgent ? "bg-warning/15 text-warning" : "bg-accent/10 text-accent"}`}><CreditCard className="h-5 w-5" /></div>
                    <div className="min-w-0"><div className="truncate font-semibold">{item.name}</div><div className="mt-1 flex flex-wrap gap-1.5 text-[10px]"><span className="rounded-full bg-secondary px-2 py-1 text-muted-foreground">{item.category || "Uncategorized"}</span><span className={`rounded-full px-2 py-1 ${item.autopay ? "bg-emerald-500/10 text-emerald-400" : "bg-secondary text-muted-foreground"}`}>{item.autopay ? "Auto-pay" : "Manual"}</span>{!item.is_active && <span className="rounded-full bg-warning/10 px-2 py-1 text-warning">Paused</span>}</div></div>
                  </div>
                    <div className="shrink-0 text-right"><div className="font-display text-2xl tabular-nums">{displayMoney(Number(item.amount))}</div><div className="text-xs capitalize text-muted-foreground">{item.cadence}</div></div>
                </div>
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4 text-xs"><span className={urgent ? "font-medium text-warning" : "text-muted-foreground"}>{renewalLabel(days)}</span><span className="flex items-center gap-1 text-muted-foreground">Details <ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} /></span></div>
              </button>

              {expanded && (
                <div className="border-t border-border bg-secondary/15 p-5">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-background/60 p-3"><CalendarClock className="mb-2 h-4 w-4 text-accent" /><div className="text-xs text-muted-foreground">Next renewal</div><div className="mt-1 font-medium">{new Date(`${item.next_due_date}T12:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}</div></div>
                    <div className="rounded-2xl bg-background/60 p-3"><Sparkles className="mb-2 h-4 w-4 text-accent" /><div className="text-xs text-muted-foreground">True monthly cost</div><div className="mt-1 font-medium">{displayMoney(monthlyCost)}</div></div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="secondary" className="flex-1 rounded-xl" disabled={updateActive.isPending} onClick={() => updateActive.mutate({ id: item.id, active: !item.is_active })}>{item.is_active ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}{item.is_active ? "Pause" : "Resume"}</Button>
                    {deleteId === item.id ? (
                      <div className="flex gap-2"><Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setDeleteId(null)}>Cancel</Button><Button size="sm" className="rounded-xl bg-destructive text-destructive-foreground" disabled={remove.isPending} onClick={() => remove.mutate(item.id)}>Remove</Button></div>
                    ) : (
                      <Button size="sm" variant="ghost" className="rounded-xl text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <Link to="/bill-calendar" className="flex items-center justify-between rounded-3xl border border-border bg-card p-5 transition hover:border-accent/35 active:scale-[0.99]">
        <div><div className="font-semibold">See every recurring payment</div><div className="mt-1 text-xs text-muted-foreground">Open the full bill and cash-flow timeline.</div></div><ArrowRight className="h-5 w-5 text-accent" />
      </Link>
    </div>
  );
}
