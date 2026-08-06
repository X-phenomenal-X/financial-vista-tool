import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Database,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAllData, usePaydayPlans, useStatementImports } from "@/lib/queries";
import { coachAnswer, QUICK_PROMPTS, todayAction } from "@/lib/coach";
import { financialHealth } from "@/lib/financial-health";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "Wealthpilot Copilot" },
      { name: "description", content: "A private financial copilot using your live Wealthpilot data." },
    ],
  }),
  component: AssistantPage,
});

interface Msg {
  role: "user" | "coach";
  text: string;
}

const DEFAULT_MESSAGE: Msg = {
  role: "coach",
  text: "I’m your Wealthpilot Copilot. I use your saved accounts, debts, transactions, budgets, reminders, payday plans, and statement imports. I will not invent missing numbers.",
};

function AssistantPage() {
  const { user } = useAuth();
  const base = useAllData(user?.id);
  const { data: paydayPlans = [], isLoading: plansLoading } = usePaydayPlans(user?.id);
  const { data: statementImports = [], isLoading: importsLoading } = useStatementImports(user?.id);
  const ctx = useMemo(() => ({ ...base, paydayPlans, statementImports }), [base, paydayPlans, statementImports]);
  const health = useMemo(() => financialHealth(ctx), [ctx]);
  const storageKey = user?.id ? `wealthpilot-copilot-${user.id}` : "wealthpilot-copilot";
  const [msgs, setMsgs] = useState<Msg[]>([DEFAULT_MESSAGE]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const loading = base.loading || plansLoading || importsLoading;

  useEffect(() => {
    if (!user) return;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Msg[];
        if (Array.isArray(parsed) && parsed.length) setMsgs(parsed);
      }
    } catch {
      setMsgs([DEFAULT_MESSAGE]);
    }
  }, [storageKey, user]);

  useEffect(() => {
    if (!user) return;
    window.localStorage.setItem(storageKey, JSON.stringify(msgs.slice(-40)));
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, storageKey, user]);

  function ask(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    const answer = coachAnswer(question, ctx);
    setMsgs((items) => [...items, { role: "user", text: question }, { role: "coach", text: answer }]);
    setInput("");
  }

  function clearChat() {
    setMsgs([DEFAULT_MESSAGE]);
    window.localStorage.removeItem(storageKey);
  }

  const activeSources = [
    `${base.accounts.length} accounts`,
    `${base.debts.length} debts`,
    `${base.transactions.length} transactions`,
    `${paydayPlans.length} payday plans`,
    `${statementImports.filter((item) => item.status === "pending").length} pending imports`,
  ];

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col pb-4">
      <header className="mb-4 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-grad shadow-card">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl leading-tight">Wealthpilot Copilot</h1>
          <p className="text-xs text-muted-foreground">Private · live data · explainable answers</p>
        </div>
        <Button size="icon" variant="ghost" onClick={clearChat} aria-label="Clear conversation">
          <Trash2 className="h-4 w-4" />
        </Button>
      </header>

      <section className="mb-4 overflow-hidden rounded-3xl border border-accent/20 bg-gradient-to-br from-card via-card to-accent/10 p-4 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <Activity className="h-3.5 w-3.5 text-accent" /> Today’s priority
            </div>
            <div className="mt-2 text-sm leading-relaxed">{loading ? "Reading your latest data…" : todayAction(ctx)}</div>
          </div>
          <Link to="/financial-health" className="shrink-0 rounded-2xl bg-secondary/70 px-3 py-2 text-center">
            <div className="text-lg font-semibold">{health.score}</div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Health</div>
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {activeSources.map((source) => (
            <span key={source} className="rounded-full bg-secondary px-2 py-1 text-[10px] text-muted-foreground">{source}</span>
          ))}
        </div>
      </section>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Link to="/bill-calendar" className="rounded-2xl border border-border bg-card p-3 text-center text-xs hover:border-accent/40">
          <WalletCards className="mx-auto mb-1 h-4 w-4 text-accent" /> Bills
        </Link>
        <Link to="/payday" className="rounded-2xl border border-border bg-card p-3 text-center text-xs hover:border-accent/40">
          <Database className="mx-auto mb-1 h-4 w-4 text-accent" /> Payday
        </Link>
        <Link to="/financial-health" className="rounded-2xl border border-border bg-card p-3 text-center text-xs hover:border-accent/40">
          <ShieldCheck className="mx-auto mb-1 h-4 w-4 text-accent" /> Health
        </Link>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto" aria-live="polite">
        {msgs.map((message, index) => (
          <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : ""}>
            <div className={message.role === "user"
              ? "max-w-[85%] rounded-2xl rounded-br-md bg-violet-grad px-4 py-2.5 text-sm text-primary-foreground"
              : "max-w-[95%] whitespace-pre-line rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground shadow-card"}
            >
              {message.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
        {QUICK_PROMPTS.map((prompt) => (
          <button key={prompt} onClick={() => ask(prompt)} disabled={loading}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-accent/50 hover:text-foreground disabled:opacity-50">
            {prompt}
          </button>
        ))}
      </div>

      <form onSubmit={(event) => { event.preventDefault(); ask(input); }} className="mt-3 flex gap-2 rounded-2xl border border-border bg-card p-2 shadow-card">
        <Input value={input} onChange={(event) => setInput(event.target.value)}
          placeholder={loading ? "Reading your data…" : "Ask: Can I afford $300 this weekend?"}
          disabled={loading} aria-label="Ask Wealthpilot Copilot" className="border-0 bg-transparent shadow-none focus-visible:ring-0" />
        <Button type="submit" size="icon" className="bg-violet-grad" disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        Answers are calculations and rules from saved app data, not personalized investment or credit-product advice.
      </p>
    </div>
  );
}
