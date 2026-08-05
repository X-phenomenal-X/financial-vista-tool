import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Database, Send, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAllData, usePaydayPlans, useStatementImports } from "@/lib/queries";
import { coachAnswer, QUICK_PROMPTS, todayAction } from "@/lib/coach";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "Assistant — Money Map" },
      { name: "description", content: "A built-in financial coach using live Money Map data." },
    ],
  }),
  component: AssistantPage,
});

interface Msg {
  role: "user" | "coach";
  text: string;
}

function AssistantPage() {
  const { user } = useAuth();
  const base = useAllData(user?.id);
  const { data: paydayPlans = [], isLoading: plansLoading } = usePaydayPlans(user?.id);
  const { data: statementImports = [], isLoading: importsLoading } = useStatementImports(user?.id);
  const ctx = useMemo(
    () => ({ ...base, paydayPlans, statementImports }),
    [base, paydayPlans, statementImports],
  );
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "coach",
      text: "Hey Abhi — I use your saved accounts, debts, transactions, budget, reminders, payday plans, and statement imports. I will not invent missing numbers.",
    },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const loading = base.loading || plansLoading || importsLoading;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  function ask(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    const answer = coachAnswer(question, ctx);
    setMsgs((items) => [...items, { role: "user", text: question }, { role: "coach", text: answer }]);
    setInput("");
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
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-grad shadow-card">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl leading-tight">Coach</h1>
          <p className="text-xs text-muted-foreground">Private · rules-based · no paid AI required</p>
        </div>
        <div className="hidden items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-success sm:flex">
          <Database className="h-3 w-3" /> Live data
        </div>
      </header>

      <section className="mb-4 rounded-2xl border border-border bg-card p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">What needs attention</div>
        <div className="mt-1 text-sm">{loading ? "Reading your latest data…" : todayAction(ctx)}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {activeSources.map((source) => (
            <span key={source} className="rounded-full bg-secondary px-2 py-1 text-[10px] text-muted-foreground">
              {source}
            </span>
          ))}
        </div>
      </section>

      <div className="flex-1 space-y-3 overflow-y-auto" aria-live="polite">
        {msgs.map((message, index) => (
          <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : ""}>
            <div
              className={
                message.role === "user"
                  ? "max-w-[85%] rounded-2xl bg-violet-grad px-4 py-2.5 text-sm text-primary-foreground"
                  : "max-w-[95%] whitespace-pre-line rounded-2xl bg-card px-4 py-3 text-sm text-foreground shadow-card"
              }
            >
              {message.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => ask(prompt)}
            disabled={loading}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-accent/50 hover:text-foreground disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(input);
        }}
        className="mt-3 flex gap-2"
      >
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={loading ? "Reading your data…" : "Ask about your money…"}
          disabled={loading}
          aria-label="Ask the financial coach"
        />
        <Button type="submit" size="icon" className="bg-violet-grad" disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        Coach answers are calculations and rules from saved app data, not financial-product recommendations.
      </p>
    </div>
  );
}
