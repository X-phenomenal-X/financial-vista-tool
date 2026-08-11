import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, PartyPopper, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { money } from "@/lib/format";
import { celebrate } from "@/lib/celebrate";
import type { Debt } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Payment scheduled" },
  { value: "pending", label: "Payment pending" },
  { value: "past_due", label: "Past due" },
  { value: "cleared", label: "Cleared" },
] as const;

type FormState = {
  balance: string;
  pending: string;
  apr: string;
  credit_limit: string;
  minimum_payment: string;
  due_date: string;
  status: string;
  priority: string;
};

function toForm(debt: Debt): FormState {
  return {
    balance: String(debt.balance ?? ""),
    pending: String(debt.pending ?? 0),
    apr: String(debt.apr ?? ""),
    credit_limit: debt.credit_limit === null ? "" : String(debt.credit_limit),
    minimum_payment: String(debt.minimum_payment ?? ""),
    due_date: debt.due_date ?? "",
    status: debt.status ?? "active",
    priority: String(debt.priority ?? 1),
  };
}

/**
 * Editor for a single debt.
 *
 * The spec asks for editable balances, rates, limits, minimums, due dates,
 * status and priority, but the only write path was the statement importer —
 * so a payment made by hand could never be recorded.
 */
export function DebtEditSheet({
  debt,
  open,
  onOpenChange,
}: {
  debt: Debt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => (debt ? toForm(debt) : toForm({} as Debt)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (debt && open) setForm(toForm(debt));
  }, [debt, open]);

  if (!debt) return null;

  const set = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const number = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  async function save() {
    if (!debt) return;

    const balance = number(form.balance);
    const apr = number(form.apr);
    const minimum = number(form.minimum_payment);
    const pending = number(form.pending);
    const priority = number(form.priority);
    const limit = form.credit_limit.trim() === "" ? null : number(form.credit_limit);

    if (balance === null || balance < 0) return toast.error("Enter a balance of zero or more.");
    if (apr === null || apr < 0 || apr > 100) return toast.error("Enter an APR between 0 and 100.");
    if (minimum === null || minimum < 0) return toast.error("Enter a minimum payment of zero or more.");
    if (pending === null) return toast.error("Enter a valid pending amount.");
    if (priority === null || priority < 1) return toast.error("Priority must be 1 or higher.");
    if (form.credit_limit.trim() !== "" && (limit === null || limit < 0)) {
      return toast.error("Enter a credit limit of zero or more.");
    }

    // Clearing the balance and leaving the status as active would keep the
    // card in the payoff plan, so keep the two in step.
    const status = balance === 0 && form.status !== "cleared" ? "cleared" : form.status;
    const wasOutstanding = Number(debt.balance) + Number(debt.pending || 0) > 0;
    const nowCleared = status === "cleared" || balance + (pending ?? 0) === 0;

    setSaving(true);
    const { error } = await supabase
      .from("debts")
      .update({
        balance,
        pending: pending ?? 0,
        apr,
        credit_limit: limit,
        minimum_payment: minimum,
        // minimum_payment is no longer the seeded estimate once it's typed in.
        minimum_estimated: minimum !== Number(debt.minimum_payment) ? false : debt.minimum_estimated,
        due_date: form.due_date || null,
        status,
        priority,
      })
      .eq("id", debt.id);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    await logAudit(debt.user_id, "debt", "updated", `Updated ${debt.name}`, {
      balance,
      apr,
      minimum_payment: minimum,
      status,
    });
    await queryClient.invalidateQueries();
    onOpenChange(false);

    if (wasOutstanding && nowCleared) {
      celebrate();
      toast.success(`${debt.name} is cleared. That's one gone.`, { icon: <PartyPopper className="h-4 w-4" /> });
    } else {
      toast.success(`${debt.name} updated`);
    }
  }

  const projectedUtilization =
    form.credit_limit && Number(form.credit_limit) > 0
      ? (Number(form.balance || 0) + Number(form.pending || 0)) / Number(form.credit_limit)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{debt.name}</DialogTitle>
          <DialogDescription>
            Update what you owe after a payment or a new statement. Nothing else changes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Balance" htmlFor="debt-balance">
            <Input
              id="debt-balance"
              inputMode="decimal"
              value={form.balance}
              onChange={(e) => set("balance", e.target.value)}
            />
          </Field>
          <Field label="Pending" htmlFor="debt-pending" hint="Charges not yet posted">
            <Input
              id="debt-pending"
              inputMode="decimal"
              value={form.pending}
              onChange={(e) => set("pending", e.target.value)}
            />
          </Field>
          <Field label="APR %" htmlFor="debt-apr">
            <Input
              id="debt-apr"
              inputMode="decimal"
              value={form.apr}
              onChange={(e) => set("apr", e.target.value)}
            />
          </Field>
          <Field label="Credit limit" htmlFor="debt-limit" hint="Blank if not a card">
            <Input
              id="debt-limit"
              inputMode="decimal"
              value={form.credit_limit}
              onChange={(e) => set("credit_limit", e.target.value)}
            />
          </Field>
          <Field label="Minimum payment" htmlFor="debt-min">
            <Input
              id="debt-min"
              inputMode="decimal"
              value={form.minimum_payment}
              onChange={(e) => set("minimum_payment", e.target.value)}
            />
          </Field>
          <Field label="Due date" htmlFor="debt-due">
            <Input
              id="debt-due"
              type="date"
              value={form.due_date}
              onChange={(e) => set("due_date", e.target.value)}
            />
          </Field>
          <Field label="Status" htmlFor="debt-status">
            <Select value={form.status} onValueChange={(value) => set("status", value)}>
              <SelectTrigger id="debt-status" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Payoff priority" htmlFor="debt-priority" hint="1 is paid first">
            <Input
              id="debt-priority"
              inputMode="numeric"
              value={form.priority}
              onChange={(e) => set("priority", e.target.value)}
            />
          </Field>
        </div>

        {projectedUtilization !== null && (
          <div
            className={`rounded-xl px-3 py-2.5 text-xs ${
              projectedUtilization >= 1
                ? "bg-destructive/10 text-destructive"
                : projectedUtilization >= 0.8
                  ? "bg-warning/10 text-warning"
                  : "bg-secondary/50 text-muted-foreground"
            }`}
          >
            Utilization after saving: {Math.round(projectedUtilization * 100)}% of{" "}
            {money(Number(form.credit_limit))}
            {projectedUtilization >= 0.8 && " — high utilization affects your credit score."}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Discard
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
