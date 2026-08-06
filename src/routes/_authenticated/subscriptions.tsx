import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CreditCard, Pause, Play, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/subscriptions")({
  head: () => ({ meta: [{ title: "Subscriptions — Wealthpilot" }] }),
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

function SubscriptionsPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const db = supabase as any;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", amount: "", cadence: "monthly", next_due_date: "", category: "Entertainment", autopay: true });

  const subscriptions = useQuery({
    queryKey: ["subscriptions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await db.from("recurring_transactions").select("id,name,merchant,amount,cadence,next_due_date,category,autopay,is_active").eq("kind", "subscription").order("next_due_date");
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
      setForm({ name: "", amount: "", cadence: "monthly", next_due_date: "", category: "Entertainment", autopay: true });
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
    onSuccess: () => client.invalidateQueries({ queryKey: ["subscriptions", user?.id] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("recurring_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subscription removed");
      client.invalidateQueries({ queryKey: ["subscriptions", user?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = subscriptions.data ?? [];
  const active = rows.filter((item) => item.is_active);
  const monthly = useMemo(() => active.reduce((sum, item) => sum + Number(item.amount) * monthlyFactor[item.cadence], 0), [active]);
  const annual = monthly * 12;
  const nextSevenDays = active.filter((item) => {
    const days = Math.ceil((new Date(`${item.next_due_date}T12:00:00`).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 7;
  }).length;

  if (subscriptions.isLoading) return <div className="pt-20 text-center text-muted-foreground">Loading subscriptions…</div>;

  return (
    <div className="space-y-6 pb-8">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Recurring spending</p>
          <h1 className="font-display text-3xl">Subscriptions</h1>
        </div>
        <Button className="bg-violet-grad" onClick={() => setOpen((value) => !value)}><Plus className="mr-2 h-4 w-4" />Add</Button>
      </header>

      <section className="overflow-hidden rounded-3xl bg-hero p-6 shadow-elevated">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground"><Sparkles className="h-4 w-4 text-accent" />Monthly subscriptions</div>
        <div className="mt-2 font-display text-5xl tabular-nums">{money(monthly)}</div>
        <div className="mt-2 text-sm text-muted-foreground">{money(annual)} per year</div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card/60 p-4"><div className="text-xs text-muted-foreground">Active</div><div className="mt-1 font-display text-2xl">{active.length}</div></div>
          <div className="rounded-2xl bg-card/60 p-4"><div className="text-xs text-muted-foreground">Due this week</div><div className="mt-1 font-display text-2xl">{nextSevenDays}</div></div>
        </div>
      </section>

      {open && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-semibold">Add subscription</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Spotify" /></div>
            <div><Label>Amount</Label><Input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="12.99" /></div>
            <div><Label>Cadence</Label><select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value })}><option value="monthly">Monthly</option><option value="annual">Annual</option><option value="weekly">Weekly</option><option value="quarterly">Quarterly</option><option value="semiannual">Every 6 months</option></select></div>
            <div><Label>Next renewal</Label><Input type="date" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} /></div>
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={form.autopay} onChange={(e) => setForm({ ...form, autopay: e.target.checked })} />Auto-pay</label>
          </div>
          <Button className="mt-5 w-full bg-violet-grad" disabled={createSubscription.isPending} onClick={() => createSubscription.mutate()}>{createSubscription.isPending ? "Saving…" : "Save subscription"}</Button>
        </section>
      )}

      <section className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">No subscriptions yet. Add the services you pay for and Wealthpilot will show their true monthly and yearly cost.</div>
        ) : rows.map((item) => {
          const monthlyCost = Number(item.amount) * monthlyFactor[item.cadence];
          return (
            <article key={item.id} className={`rounded-2xl border border-border bg-card p-5 shadow-card transition ${item.is_active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.category || "Uncategorized"} · {item.autopay ? "Auto-pay" : "Manual payment"}</div>
                </div>
                <div className="text-right"><div className="font-display text-xl tabular-nums">{money(Number(item.amount))}</div><div className="text-xs capitalize text-muted-foreground">{item.cadence}</div></div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-secondary/40 p-3"><CalendarClock className="mb-2 h-4 w-4 text-accent" /><div className="text-xs text-muted-foreground">Next renewal</div><div>{new Date(`${item.next_due_date}T12:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}</div></div>
                <div className="rounded-xl bg-secondary/40 p-3"><CreditCard className="mb-2 h-4 w-4 text-accent" /><div className="text-xs text-muted-foreground">True monthly cost</div><div>{money(monthlyCost)}</div></div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => updateActive.mutate({ id: item.id, active: !item.is_active })}>{item.is_active ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}{item.is_active ? "Pause" : "Resume"}</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(item.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
