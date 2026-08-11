import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toDateKey } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { useAccounts, useBudget, useDebts } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Delete } from "lucide-react";

const TYPES = [
  { v: "expense", label: "Expense" },
  { v: "income", label: "Income" },
  { v: "debt_payment", label: "Debt payment" },
  { v: "transfer", label: "Transfer" },
];

export function QuickAddDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: accounts = [] } = useAccounts(user?.id);
  const { data: budget = [] } = useBudget(user?.id);
  const { data: debts = [] } = useDebts(user?.id);
  const [amount, setAmount] = useState("0");
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [debtId, setDebtId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [needWant, setNeedWant] = useState("need");
  const [cleared, setCleared] = useState(true);
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount("0");
      setDescription("");
      setDebtId("");
    }
  }, [open]);

  const tap = (k: string) => {
    setAmount((a) => {
      if (k === "back") return a.length <= 1 ? "0" : a.slice(0, -1);
      if (k === ".") return a.includes(".") ? a : a + ".";
      if (a === "0") return k;
      return a + k;
    });
  };

  async function save() {
    if (!user) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter an amount");
      return;
    }
    setSaving(true);
    const signed = type === "income" ? amt : -amt;
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      occurred_on: date,
      type,
      category: category || null,
      account_id: accountId || null,
      debt_id: type === "debt_payment" ? debtId || null : null,
      description: description || null,
      amount: signed,
      need_want: type === "expense" ? needWant : null,
      cleared,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    qc.invalidateQueries();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quick add</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-2xl bg-secondary/60 p-4 text-center">
            <div className="font-display text-4xl tabular-nums">${amount}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {TYPES.find((t) => t.v === type)?.label}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"].map((k) => (
              <Button key={k} variant="secondary" className="h-12 text-lg" onClick={() => tap(k)}>
                {k === "back" ? <Delete className="h-4 w-4" /> : k}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.v} value={t.v}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {budget.map((b) => (
                    <SelectItem key={b.id} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {type === "debt_payment" && (
              <div className="col-span-2">
                <Label className="text-xs">Debt</Label>
                <Select value={debtId} onValueChange={setDebtId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {debts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2">
              <Label className="text-xs">Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Merchant / note"
              />
            </div>
            {type === "expense" && (
              <div className="col-span-2 flex gap-2">
                <Button
                  variant={needWant === "need" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setNeedWant("need")}
                >
                  Need
                </Button>
                <Button
                  variant={needWant === "want" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setNeedWant("want")}
                >
                  Want
                </Button>
              </div>
            )}
            <div className="col-span-2 flex gap-2">
              <Button
                variant={cleared ? "default" : "outline"}
                className="flex-1"
                onClick={() => setCleared(true)}
              >
                Cleared
              </Button>
              <Button
                variant={!cleared ? "default" : "outline"}
                className="flex-1"
                onClick={() => setCleared(false)}
              >
                Pending
              </Button>
            </div>
          </div>
          <Button className="w-full" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save transaction"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
