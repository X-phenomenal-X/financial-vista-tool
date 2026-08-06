import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, CalendarClock, RefreshCw, CreditCard, WalletCards } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Wealthpilot" }] }),
  component: NotificationCenter,
});

type AlertItem = {
  key: string;
  title: string;
  body: string;
  tone: "danger" | "warning" | "info";
  href: "/bill-calendar" | "/subscriptions" | "/debts" | "/payday";
  action: string;
};

function daysUntil(date: string) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(`${date}T00:00:00`);
  return Math.ceil((due.getTime() - now.getTime()) / 86400000);
}

function NotificationCenter() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!user) return;
    setLoading(true);
    const [{ data: recurring }, { data: accounts }, { data: debts }, { data: log }] = await Promise.all([
      supabase.from("recurring_transactions").select("id,name,kind,amount,next_due_date,is_active,autopay").eq("is_active", true).order("next_due_date"),
      supabase.from("accounts").select("balance"),
      supabase.from("debts").select("id,name,balance,pending,credit_limit,status,due_date,minimum_payment"),
      supabase.from("notification_log").select("*").order("created_at", { ascending: false }).limit(50),
    ]);

    const next: AlertItem[] = [];
    const cash = (accounts ?? []).reduce((sum: number, account: any) => sum + Number(account.balance || 0), 0);
    if (cash < 500) next.push({ key: "cash-buffer", title: "Cash buffer is below $500", body: `Available cash is ${money(cash)}. Protect the buffer before extra spending or debt payments.`, tone: "danger", href: "/payday", action: "Review payday plan" });

    const dueSoon = (recurring ?? []).filter((item: any) => daysUntil(item.next_due_date) >= 0 && daysUntil(item.next_due_date) <= 7);
    const projected = cash - dueSoon.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
    if (projected < 500 && dueSoon.length) next.push({ key: "projected-buffer", title: "Upcoming payments may reduce your buffer", body: `After bills and renewals due within 7 days, projected cash is ${money(projected)}.`, tone: projected < 0 ? "danger" : "warning", href: "/bill-calendar", action: "Open bill calendar" });

    for (const item of recurring ?? []) {
      const days = daysUntil(item.next_due_date);
      if (days < 0) {
        next.push({ key: `overdue-${item.id}`, title: `${item.name} is overdue`, body: `${money(item.amount)} was due ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago.`, tone: "danger", href: item.kind === "subscription" ? "/subscriptions" : "/bill-calendar", action: "Review now" });
      } else if (days <= 7) {
        const isSubscription = item.kind === "subscription";
        next.push({ key: `due-${item.id}`, title: `${item.name} ${isSubscription ? "renews" : "is due"} in ${days} day${days === 1 ? "" : "s"}`, body: `${money(item.amount)}${item.autopay ? " on autopay" : " requires attention"}.`, tone: days <= 2 && !item.autopay ? "warning" : "info", href: isSubscription ? "/subscriptions" : "/bill-calendar", action: isSubscription ? "View subscription" : "View bill" });
      }
    }

    for (const debt of debts ?? []) {
      const used = Number(debt.balance || 0) + Number(debt.pending || 0);
      const limit = Number(debt.credit_limit || 0);
      const utilization = limit > 0 ? used / limit : 0;
      if (debt.status === "past_due") next.push({ key: `past-due-${debt.id}`, title: `${debt.name} is past due`, body: `Pay at least ${money(debt.minimum_payment || 0)} as soon as possible.`, tone: "danger", href: "/debts", action: "Open debt" });
      else if (utilization >= 0.8) next.push({ key: `util-${debt.id}`, title: `${debt.name} utilization is ${Math.round(utilization * 100)}%`, body: "Paying this balance down can reduce credit risk.", tone: utilization >= 1 ? "danger" : "warning", href: "/debts", action: "Review debt" });
    }

    setAlerts(next);
    setHistory(log ?? []);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todays = (log ?? []).filter((item: any) => new Date(item.created_at) >= today);
    const fresh = next.filter((alert) => !todays.some((item: any) => item.title === alert.title && item.body === alert.body));
    if (fresh.length) {
      await supabase.from("notification_log").insert(fresh.map((alert) => ({ user_id: user.id, title: alert.title, body: alert.body, channel: "in_app", read: false })));
      const { data: updated } = await supabase.from("notification_log").select("*").order("created_at", { ascending: false }).limit(50);
      setHistory(updated ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [user?.id]);

  const unread = useMemo(() => history.filter((item) => !item.read).length, [history]);

  async function markAllRead() {
    if (!user) return;
    await supabase.from("notification_log").update({ read: true }).eq("user_id", user.id);
    setHistory((items) => items.map((item) => ({ ...item, read: true })));
  }

  return (
    <div className="space-y-5 pb-8">
      <header className="flex items-start justify-between gap-3">
        <div><h1 className="font-display text-2xl">Notification Center</h1><p className="text-xs text-muted-foreground">Bills, subscriptions, cash risks, and credit alerts refresh automatically.</p></div>
        <div className="rounded-full bg-accent/15 px-3 py-1 text-xs text-accent">{unread} unread</div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Bell className="h-4 w-4 text-accent" /><h2 className="text-sm font-semibold">Live alerts</h2></div><Button size="sm" variant="secondary" onClick={refresh} disabled={loading}><RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div>
        <div className="mt-3 space-y-2">
          {alerts.map((alert) => <div key={alert.key} className={`rounded-xl border p-3 ${alert.tone === "danger" ? "border-destructive/40 bg-destructive/10" : alert.tone === "warning" ? "border-warning/40 bg-warning/10" : "border-border bg-secondary/30"}`}><div className="text-sm font-medium">{alert.title}</div><div className="mt-1 text-xs text-muted-foreground">{alert.body}</div><Link to={alert.href} className="mt-2 inline-flex text-xs text-accent">{alert.action}</Link></div>)}
          {!loading && !alerts.length && <div className="rounded-xl bg-success/10 p-4 text-center text-xs text-success">No financial risks need attention right now.</div>}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Link to="/bill-calendar" className="rounded-2xl border border-border bg-card p-4"><CalendarClock className="h-5 w-5 text-accent" /><div className="mt-2 text-sm font-medium">Bills</div></Link>
        <Link to="/subscriptions" className="rounded-2xl border border-border bg-card p-4"><RefreshCw className="h-5 w-5 text-warning" /><div className="mt-2 text-sm font-medium">Subscriptions</div></Link>
        <Link to="/debts" className="rounded-2xl border border-border bg-card p-4"><CreditCard className="h-5 w-5 text-destructive" /><div className="mt-2 text-sm font-medium">Debts</div></Link>
        <Link to="/payday" className="rounded-2xl border border-border bg-card p-4"><WalletCards className="h-5 w-5 text-accent" /><div className="mt-2 text-sm font-medium">Payday plan</div></Link>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">History</h2>{!!unread && <Button size="sm" variant="ghost" onClick={markAllRead}><CheckCheck className="mr-1 h-3.5 w-3.5" />Mark all read</Button>}</div><div className="mt-3 space-y-2">{history.map((item) => <div key={item.id} className={`rounded-xl border p-3 ${item.read ? "border-border opacity-60" : "border-accent/30 bg-accent/5"}`}><div className="text-sm">{item.title}</div>{item.body && <div className="mt-1 text-xs text-muted-foreground">{item.body}</div>}<div className="mt-2 text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString("en-CA")}</div></div>)}</div></section>
    </div>
  );
}
