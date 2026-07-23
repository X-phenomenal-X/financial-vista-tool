import { createFileRoute, Link } from "@tanstack/react-router";
import { CreditCard, Target, Bell, Upload, Settings, LogOut, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/more")({
  head: () => ({ meta: [{ title: "More — Money Map" }, { name: "description", content: "Debts, goals, automations, uploads, and settings." }] }),
  component: MorePage,
});

function MorePage() {
  const navigate = useNavigate();
  const items = [
    { to: "/debts", label: "Debts", icon: CreditCard },
    { to: "/goals", label: "Goals", icon: Target },
    { to: "/automations", label: "Automations", icon: Bell },
    { to: "/uploads", label: "Statement uploads", icon: Upload },
    { to: "/settings", label: "Settings", icon: Settings },
  ] as const;
  return (
    <div className="space-y-4 pb-8">
      <h1 className="font-display text-2xl">More</h1>
      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        {items.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center gap-3 px-4 py-4 text-sm hover:bg-secondary/40">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-accent"><Icon className="h-4 w-4" /></div>
            <div className="flex-1">{label}</div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
      <button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-4 text-sm text-destructive">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}