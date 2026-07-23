import { createFileRoute } from "@tanstack/react-router";
import { Upload, FileText, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/uploads")({
  head: () => ({ meta: [{ title: "Statement Uploads — Money Map" }, { name: "description", content: "Upload bank, credit card, pay stub, and retirement statements." }] }),
  component: UploadsPage,
});

function UploadsPage() {
  return (
    <div className="space-y-5 pb-8">
      <h1 className="font-display text-2xl">Statement uploads</h1>
      <section className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-grad shadow-card"><Upload className="h-6 w-6 text-primary-foreground" /></div>
        <h2 className="mt-4 font-display text-lg">Coming next</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Upload bank statements, credit-card statements, pay stubs, and retirement statements. Money Map will extract candidate balances and transactions, then always show a review-and-confirm screen before anything is saved.</p>
      </section>
      <div className="grid grid-cols-2 gap-3 text-xs">
        {["Bank statement","Credit card","Pay stub","Retirement"].map((k) => (
          <div key={k} className="rounded-2xl border border-border bg-card p-4"><FileText className="h-4 w-4 text-accent" /><div className="mt-2 font-medium">{k}</div><div className="text-muted-foreground">PDF · CSV · text</div></div>
        ))}
      </div>
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground"><Shield className="mt-0.5 h-4 w-4 text-accent" /><span>Nothing extracted is saved automatically. Every balance and transaction goes through a review-and-confirm screen — Money Map never overwrites silently.</span></div>
    </div>
  );
}