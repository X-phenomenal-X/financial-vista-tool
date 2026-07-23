import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useReminders } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Check } from "lucide-react";
import { currentPermission, requestBrowserNotifications } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({ meta: [{ title: "Automations — Money Map" }, { name: "description", content: "In-app and browser reminders." }] }),
  component: AutomationsPage,
});

function AutomationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: reminders = [] } = useReminders(user?.id);
  const [perm, setPerm] = useState<string>("default");
  useEffect(() => { setPerm(currentPermission()); }, []);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [recurrence, setRecurrence] = useState("once");
  const [kind, setKind] = useState("custom");

  async function askPerm() { const r = await requestBrowserNotifications(); setPerm(r); if (r === "granted") toast.success("Notifications enabled"); }

  async function add() {
    if (!user || !title.trim()) return;
    const { error } = await supabase.from("reminders").insert({ user_id: user.id, title, due_at: new Date(dueAt).toISOString(), recurrence, kind });
    if (error) return toast.error(error.message);
    setTitle(""); qc.invalidateQueries({ queryKey: ["reminders", user.id] }); toast.success("Reminder added");
  }
  async function toggle(id: string, completed: boolean) {
    await supabase.from("reminders").update({ completed: !completed }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["reminders", user?.id] });
  }

  return (
    <div className="space-y-5 pb-8">
      <h1 className="font-display text-2xl">Automations</h1>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          {perm === "granted" ? <Bell className="h-5 w-5 text-accent" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
          <div className="flex-1"><div className="text-sm font-medium">Browser notifications</div><div className="text-xs text-muted-foreground">{perm === "granted" ? "Enabled" : perm === "denied" ? "Blocked in your browser settings" : perm === "unsupported" ? "Not supported on this device" : "Not asked yet — in-app reminders still work"}</div></div>
          {perm !== "granted" && perm !== "denied" && perm !== "unsupported" && <Button size="sm" onClick={askPerm}>Enable</Button>}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">New reminder</h2>
        <div><Label className="text-xs">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pay RBC minimum" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">When</Label><Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
          <div><Label className="text-xs">Repeat</Label>
            <Select value={recurrence} onValueChange={setRecurrence}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="once">Once</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="biweekly">Biweekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label className="text-xs">Kind</Label>
            <Select value={kind} onValueChange={setKind}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="custom">Custom</SelectItem><SelectItem value="debt_due">Debt due date</SelectItem><SelectItem value="payday">Payday check-in</SelectItem><SelectItem value="budget_review">Budget review</SelectItem><SelectItem value="statement">Statement upload</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <Button className="w-full" onClick={add}>Add reminder</Button>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Scheduled</h2>
        {reminders.map((r) => (
          <div key={r.id} className={`flex items-center gap-3 rounded-2xl border border-border bg-card p-4 ${r.completed ? "opacity-50" : ""}`}>
            <button onClick={() => toggle(r.id, r.completed)} className={`grid h-8 w-8 place-items-center rounded-full border ${r.completed ? "border-success bg-success/20 text-success" : "border-border text-muted-foreground"}`}><Check className="h-4 w-4" /></button>
            <div className="min-w-0 flex-1"><div className="truncate text-sm">{r.title}</div><div className="text-xs text-muted-foreground">{new Date(r.due_at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })} · {r.recurrence}</div>{r.notes && <div className="mt-0.5 text-xs text-muted-foreground">{r.notes}</div>}</div>
          </div>
        ))}
      </section>
    </div>
  );
}