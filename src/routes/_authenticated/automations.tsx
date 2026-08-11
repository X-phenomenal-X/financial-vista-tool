import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Clock3,
  Inbox,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAllData, useNotificationLog } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { currentPermission, notify, requestBrowserNotifications } from "@/lib/notifications";
import { advanceRecurrence, ruleAlerts } from "@/lib/reminder-rules";
import type { Reminder } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({
    meta: [
      { title: "Automations — Wealthpilot" },
      { name: "description", content: "Smart financial reminders, browser notifications, and notification history." },
    ],
  }),
  component: AutomationsPage,
});

const emptyForm = () => ({
  title: "",
  notes: "",
  dueAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
  recurrence: "once",
  kind: "custom",
  notifyBrowser: true,
});

function AutomationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const ctx = useAllData(user?.id);
  const { data: history = [], isLoading: historyLoading } = useNotificationLog(user?.id);
  const [perm, setPerm] = useState<string>("default");
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setPerm(currentPermission());
  }, []);

  const alerts = useMemo(
    () => ruleAlerts({ debts: ctx.debts, reminders: ctx.reminders, budget: ctx.budget, transactions: ctx.transactions }),
    [ctx.debts, ctx.reminders, ctx.budget, ctx.transactions],
  );

  const activeReminders = ctx.reminders.filter((r) => !r.completed);
  const completedReminders = ctx.reminders.filter((r) => r.completed);
  const unread = history.filter((item) => !item.read).length;

  async function askPerm() {
    const result = await requestBrowserNotifications();
    setPerm(result);
    if (result === "granted") toast.success("Browser notifications enabled");
    else if (result === "denied") toast.error("Notifications are blocked in your browser settings");
  }

  function startEdit(reminder: Reminder) {
    setEditId(reminder.id);
    setForm({
      title: reminder.title,
      notes: reminder.notes ?? "",
      dueAt: new Date(reminder.due_at).toISOString().slice(0, 16),
      recurrence: reminder.recurrence,
      kind: reminder.kind,
      notifyBrowser: reminder.notify_browser,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditId(null);
    setForm(emptyForm());
  }

  async function saveReminder() {
    if (!user || !form.title.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      notes: form.notes.trim() || null,
      due_at: new Date(form.dueAt).toISOString(),
      recurrence: form.recurrence,
      kind: form.kind,
      notify_browser: form.notifyBrowser,
      paused: false,
      completed: false,
    };

    const result = editId
      ? await supabase.from("reminders").update(payload).eq("id", editId)
      : await supabase.from("reminders").insert({ ...payload, user_id: user.id });

    setSaving(false);
    if (result.error) return toast.error(result.error.message);
    qc.invalidateQueries({ queryKey: ["reminders", user.id] });
    toast.success(editId ? "Reminder updated" : "Reminder added");
    resetForm();
  }

  async function complete(reminder: Reminder) {
    const next = advanceRecurrence(reminder.due_at, reminder.recurrence);
    const patch = next
      ? { due_at: next, completed: false, snoozed_until: null, last_fired_at: new Date().toISOString() }
      : { completed: true, snoozed_until: null, last_fired_at: new Date().toISOString() };
    const { error } = await supabase.from("reminders").update(patch).eq("id", reminder.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["reminders", user?.id] });
    toast.success(next ? "Completed — next occurrence scheduled" : "Reminder completed");
  }

  async function togglePause(reminder: Reminder) {
    const { error } = await supabase.from("reminders").update({ paused: !reminder.paused }).eq("id", reminder.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["reminders", user?.id] });
    toast.success(reminder.paused ? "Reminder resumed" : "Reminder paused");
  }

  async function snooze(reminder: Reminder) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const { error } = await supabase.from("reminders").update({ snoozed_until: tomorrow.toISOString() }).eq("id", reminder.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["reminders", user?.id] });
    toast.success("Snoozed until tomorrow morning");
  }

  async function remove(reminder: Reminder) {
    if (!window.confirm(`Delete “${reminder.title}”?`)) return;
    const { error } = await supabase.from("reminders").delete().eq("id", reminder.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["reminders", user?.id] });
    toast.success("Reminder deleted");
  }

  async function syncSmartAlerts() {
    if (!user || !alerts.length) return;
    setSyncing(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todays = history.filter((item) => new Date(item.created_at) >= today);
    const fresh = alerts.filter(
      (alert) => !todays.some((item) => item.title === alert.title && item.body === alert.body),
    );

    if (fresh.length) {
      const { error } = await supabase.from("notification_log").insert(
        fresh.map((alert) => ({
          user_id: user.id,
          title: alert.title,
          body: alert.body,
          channel: perm === "granted" ? "browser+in_app" : "in_app",
          read: false,
        })),
      );
      if (error) {
        setSyncing(false);
        return toast.error(error.message);
      }
      if (perm === "granted") fresh.forEach((alert) => notify(alert.title, alert.body));
      qc.invalidateQueries({ queryKey: ["notification_log", user.id] });
      toast.success(`${fresh.length} new alert${fresh.length === 1 ? "" : "s"} added`);
    } else {
      toast.success("Smart alerts are already up to date");
    }
    setSyncing(false);
  }

  async function markRead(id: string) {
    await supabase.from("notification_log").update({ read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notification_log", user?.id] });
  }

  async function markAllRead() {
    await supabase.from("notification_log").update({ read: true }).eq("user_id", user?.id ?? "");
    qc.invalidateQueries({ queryKey: ["notification_log", user?.id] });
  }

  return (
    <div className="space-y-5 pb-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Automations</h1>
          <p className="text-xs text-muted-foreground">Reminders, smart financial alerts, and notification history.</p>
        </div>
        <div className="rounded-full bg-accent/15 px-3 py-1 text-xs text-accent">{unread} unread</div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          {perm === "granted" ? <Bell className="h-5 w-5 text-accent" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
          <div className="flex-1">
            <div className="text-sm font-medium">Browser notifications</div>
            <div className="text-xs text-muted-foreground">
              {perm === "granted"
                ? "Enabled — in-app alerts stay available too"
                : perm === "denied"
                  ? "Blocked in browser settings — in-app alerts still work"
                  : perm === "unsupported"
                    ? "Not supported on this device — in-app alerts still work"
                    : "Not enabled yet — permission is requested only when you tap Enable"}
            </div>
          </div>
          {perm !== "granted" && perm !== "denied" && perm !== "unsupported" && (
            <Button size="sm" onClick={askPerm}>Enable</Button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{editId ? "Edit reminder" : "New reminder"}</h2>
          {editId && <Button size="sm" variant="ghost" onClick={resetForm}>Cancel edit</Button>}
        </div>
        <div>
          <Label className="text-xs">Title</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Pay RBC minimum" />
        </div>
        <div>
          <Label className="text-xs">Notes</Label>
          <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional detail" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">When</Label>
            <Input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Repeat</Label>
            <Select value={form.recurrence} onValueChange={(value) => setForm({ ...form, recurrence: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Once</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Biweekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Type</Label>
            <Select value={form.kind} onValueChange={(value) => setForm({ ...form, kind: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectItem value="debt_due">Debt due date</SelectItem>
                <SelectItem value="payday">Payday check-in</SelectItem>
                <SelectItem value="budget_review">Budget review</SelectItem>
                <SelectItem value="statement">Statement upload</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={form.notifyBrowser} onChange={(e) => setForm({ ...form, notifyBrowser: e.target.checked })} />
          Send a browser notification when permission is available
        </label>
        <Button className="w-full" onClick={saveReminder} disabled={saving || !form.title.trim()}>
          {saving ? "Saving…" : editId ? "Save changes" : "Add reminder"}
        </Button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Smart alerts</h2>
            <p className="text-xs text-muted-foreground">Generated from live due dates, balances, utilization, and budget progress.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={syncSmartAlerts} disabled={syncing || !alerts.length}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {alerts.slice(0, 8).map((alert) => (
            <div key={alert.id} className={`rounded-xl border px-3 py-3 ${alert.tone === "danger" ? "border-destructive/40 bg-destructive/10" : alert.tone === "warning" ? "border-warning/40 bg-warning/10" : "border-border bg-secondary/30"}`}>
              <div className="flex items-start gap-2">
                <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${alert.tone === "danger" ? "text-destructive" : alert.tone === "warning" ? "text-warning" : "text-accent"}`} />
                <div>
                  <div className="text-sm">{alert.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{alert.body}</div>
                </div>
              </div>
            </div>
          ))}
          {!alerts.length && <div className="rounded-xl bg-success/10 px-3 py-4 text-center text-xs text-success">No smart alerts right now.</div>}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Scheduled reminders</h2>
        {activeReminders.map((reminder) => (
          <ReminderRow key={reminder.id} reminder={reminder} onComplete={complete} onPause={togglePause} onSnooze={snooze} onEdit={startEdit} onDelete={remove} />
        ))}
        {!activeReminders.length && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">No active reminders.</div>
        )}
      </section>

      {!!completedReminders.length && (
        <details className="rounded-2xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold">Completed ({completedReminders.length})</summary>
          <div className="mt-3 space-y-2">
            {completedReminders.map((reminder) => (
              <div key={reminder.id} className="flex items-center gap-3 rounded-xl bg-secondary/30 p-3 opacity-65">
                <Check className="h-4 w-4 text-success" />
                <div className="min-w-0 flex-1"><div className="truncate text-sm">{reminder.title}</div></div>
                <Button size="icon" variant="ghost" onClick={() => remove(reminder)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        </details>
      )}

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold">Notification history</h2>
          </div>
          {!!unread && <Button size="sm" variant="ghost" onClick={markAllRead}><CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all read</Button>}
        </div>
        <div className="mt-3 space-y-2">
          {historyLoading && <div className="text-xs text-muted-foreground">Loading history…</div>}
          {history.slice(0, 30).map((item) => (
            <button key={item.id} onClick={() => markRead(item.id)} className={`w-full rounded-xl border p-3 text-left ${item.read ? "border-border bg-secondary/20 opacity-65" : "border-accent/30 bg-accent/5"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm">{item.title}</div>
                  {item.body && <div className="mt-0.5 text-xs text-muted-foreground">{item.body}</div>}
                </div>
                {!item.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />}
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                {new Date(item.created_at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })} · {item.channel}
              </div>
            </button>
          ))}
          {!historyLoading && !history.length && <div className="rounded-xl bg-secondary/30 px-3 py-4 text-center text-xs text-muted-foreground">Notification history will appear here.</div>}
        </div>
      </section>
    </div>
  );
}

function ReminderRow({
  reminder,
  onComplete,
  onPause,
  onSnooze,
  onEdit,
  onDelete,
}: {
  reminder: Reminder;
  onComplete: (reminder: Reminder) => void;
  onPause: (reminder: Reminder) => void;
  onSnooze: (reminder: Reminder) => void;
  onEdit: (reminder: Reminder) => void;
  onDelete: (reminder: Reminder) => void;
}) {
  const snoozed = reminder.snoozed_until && new Date(reminder.snoozed_until) > new Date();
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 ${reminder.paused ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <button onClick={() => onComplete(reminder)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:border-success hover:text-success" aria-label={`Complete ${reminder.title}`}>
          <Check className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-sm">{reminder.title}</div>
            {reminder.paused && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase text-muted-foreground">Paused</span>}
            {snoozed && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] uppercase text-warning">Snoozed</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(reminder.due_at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })} · {reminder.recurrence}
          </div>
          {reminder.notes && <div className="mt-1 text-xs text-muted-foreground">{reminder.notes}</div>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1 border-t border-border pt-3">
        <Button size="sm" variant="ghost" onClick={() => onPause(reminder)}>
          {reminder.paused ? <Play className="mr-1 h-3.5 w-3.5" /> : <Pause className="mr-1 h-3.5 w-3.5" />}
          {reminder.paused ? "Resume" : "Pause"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onSnooze(reminder)}><Clock3 className="mr-1 h-3.5 w-3.5" /> Snooze</Button>
        <Button size="sm" variant="ghost" onClick={() => onEdit(reminder)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(reminder)}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>
      </div>
    </div>
  );
}
