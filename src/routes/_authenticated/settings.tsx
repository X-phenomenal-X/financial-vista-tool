import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useAllData } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Shield, Download, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Money Map" }, { name: "description", content: "Profile, notifications, exports, and data privacy." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const ctx = useAllData(user?.id);

  function exportJson() {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), ...ctx }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `moneymap-${Date.now()}.json`; a.click();
    toast.success("Downloaded backup");
  }
  function exportCsv() {
    const header = "date,type,category,description,amount,cleared\n";
    const rows = ctx.transactions.map((t) => [t.occurred_on, t.type, t.category ?? "", (t.description ?? "").replace(/[",\n]/g, " "), t.amount, t.cleared].join(",")).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `moneymap-transactions-${Date.now()}.csv`; a.click();
  }

  return (
    <div className="space-y-5 pb-8">
      <h1 className="font-display text-2xl">Settings</h1>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Profile</h2>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{user?.email}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Owner</span><span>{profile?.is_owner ? "Yes" : "No"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span>CAD</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Timezone</span><span>America/Toronto</span></div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Backup & export</h2>
        <p className="mt-1 text-xs text-muted-foreground">Download all your data at any time.</p>
        <div className="mt-3 flex gap-2"><Button variant="secondary" onClick={exportJson}><Download className="mr-2 h-4 w-4" />JSON backup</Button><Button variant="secondary" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV transactions</Button></div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-accent" /><h2 className="text-sm font-semibold">Data privacy</h2></div>
        <p className="mt-2 text-xs text-muted-foreground">Money Map is private and single-owner. All your data is scoped to your account with row-level security. Uploaded documents always require a review-and-confirm step before any balance or transaction is saved — nothing is silently overwritten.</p>
      </section>

      <section className="rounded-2xl bg-hero p-5 shadow-card">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /><h2 className="text-sm font-semibold">AI upgrade</h2><span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Coming later</span></div>
        <p className="mt-2 text-xs text-muted-foreground">Connect a full AI assistant that can chat with your data using a provider of your choice. The built-in coach continues to work without any API.</p>
      </section>

      <Button variant="ghost" className="w-full text-destructive" onClick={async () => { await supabase.auth.signOut(); location.href = "/auth"; }}>Sign out</Button>
    </div>
  );
}