import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Copy,
  Database,
  Gauge,
  LockKeyhole,
  MessageCircleMore,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  WalletCards,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAllData, usePaydayPlans, useStatementImports } from "@/lib/queries";
import { coachAnswer, QUICK_PROMPTS, todayAction } from "@/lib/coach";
import { financialHealth } from "@/lib/financial-health";
import { Button } from "@/components/ui/button";

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

const promptIcons = [WalletCards, CalendarRange, Gauge, CircleDollarSign];

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
  const [showSources, setShowSources] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
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
    setShowClearConfirm(false);
  }

  async function copyMessage(text: string, index: number) {
    try {
      await window.navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 1600);
    } catch {
      setCopiedIndex(null);
    }
  }

  const activeSources = [
    { label: "Accounts", value: base.accounts.length },
    { label: "Debts", value: base.debts.length },
    { label: "Transactions", value: base.transactions.length },
    { label: "Payday plans", value: paydayPlans.length },
    { label: "Pending imports", value: statementImports.filter((item) => item.status === "pending").length },
  ];

  const totalSources = activeSources.reduce((sum, source) => sum + source.value, 0);
  const healthTone = health.score >= 80 ? "Strong" : health.score >= 65 ? "Stable" : health.score >= 45 ? "Watch" : "Needs focus";

  return (
    <div className="relative flex min-h-[calc(100vh-8rem)] flex-col pb-4">
      <div className="pointer-events-none absolute inset-x-0 -top-10 h-64 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-44 w-44 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute -right-10 top-16 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <header className="relative z-10 mb-4 flex items-center gap-3">
        <div className="relative grid h-12 w-12 place-items-center rounded-[1.15rem] bg-violet-grad shadow-elevated">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl leading-tight">Wealthpilot Copilot</h1>
            <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-accent">Live</span>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <LockKeyhole className="h-3 w-3" /> Private session · grounded in your data
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setShowClearConfirm(true)}
          aria-label="Clear conversation"
          className="rounded-xl border border-transparent transition hover:border-border hover:bg-card"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </header>

      {showClearConfirm && (
        <div className="relative z-20 mb-4 flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm shadow-card animate-in fade-in slide-in-from-top-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-destructive/15 text-destructive">
            <Trash2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium">Start a new conversation?</div>
            <div className="text-xs text-muted-foreground">Your saved chat history on this device will be cleared.</div>
          </div>
          <button onClick={() => setShowClearConfirm(false)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-card/60" aria-label="Cancel">
            <X className="h-4 w-4" />
          </button>
          <button onClick={clearChat} className="rounded-xl bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground transition active:scale-95">
            Clear
          </button>
        </div>
      )}

      <section className="relative z-10 mb-4 overflow-hidden rounded-[1.75rem] border border-accent/20 bg-gradient-to-br from-card via-card to-accent/10 p-5 shadow-elevated">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-accent">
              <Zap className="h-3.5 w-3.5" /> Today’s priority
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {loading ? "Reading your latest financial data…" : todayAction(ctx)}
            </p>
            <Link to="/assistant" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent">
              Ask a follow-up <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <Link
            to="/financial-health"
            className="group relative grid h-24 w-24 shrink-0 place-items-center rounded-full p-2 transition active:scale-95"
            style={{ background: `conic-gradient(hsl(var(--accent)) ${health.score * 3.6}deg, hsl(var(--secondary)) 0deg)` }}
          >
            <div className="grid h-full w-full place-items-center rounded-full border border-border/60 bg-card text-center shadow-card transition group-hover:scale-[1.03]">
              <div>
                <div className="font-display text-2xl leading-none">{health.score}</div>
                <div className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">{healthTone}</div>
              </div>
            </div>
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setShowSources((value) => !value)}
          className="relative mt-4 flex w-full items-center justify-between rounded-2xl border border-border/70 bg-background/35 px-3 py-2.5 text-left transition hover:bg-background/55 active:scale-[0.99]"
        >
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-accent/10 text-accent">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-medium">Live data connected</div>
              <div className="text-[10px] text-muted-foreground">{totalSources} records across {activeSources.length} sources</div>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showSources ? "rotate-180" : ""}`} />
        </button>

        {showSources && (
          <div className="relative mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-background/35 p-3 animate-in fade-in slide-in-from-top-2">
            {activeSources.map((source) => (
              <div key={source.label} className="flex items-center gap-2 rounded-xl bg-card/70 p-2.5">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <div className="min-w-0">
                  <div className="truncate text-[10px] text-muted-foreground">{source.label}</div>
                  <div className="text-xs font-medium">{source.value}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="relative z-10 mb-4 grid grid-cols-3 gap-2">
        <Link to="/bill-calendar" className="group rounded-2xl border border-border bg-card p-3 text-center shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 active:scale-[0.97]">
          <div className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent transition group-hover:scale-110">
            <WalletCards className="h-4 w-4" />
          </div>
          <div className="mt-2 text-xs font-medium">Bills</div>
          <div className="mt-0.5 text-[9px] text-muted-foreground">Upcoming</div>
        </Link>
        <Link to="/payday" className="group rounded-2xl border border-border bg-card p-3 text-center shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 active:scale-[0.97]">
          <div className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent transition group-hover:scale-110">
            <CircleDollarSign className="h-4 w-4" />
          </div>
          <div className="mt-2 text-xs font-medium">Payday</div>
          <div className="mt-0.5 text-[9px] text-muted-foreground">Allocate</div>
        </Link>
        <Link to="/scenario-planner" className="group rounded-2xl border border-border bg-card p-3 text-center shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 active:scale-[0.97]">
          <div className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent transition group-hover:scale-110">
            <WandSparkles className="h-4 w-4" />
          </div>
          <div className="mt-2 text-xs font-medium">What if?</div>
          <div className="mt-0.5 text-[9px] text-muted-foreground">Simulate</div>
        </Link>
      </div>

      <div className="relative z-10 mb-2 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MessageCircleMore className="h-4 w-4 text-accent" /> Conversation
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">Answers use your current Wealthpilot records</div>
        </div>
        <div className="rounded-full border border-border bg-card px-2.5 py-1 text-[9px] uppercase tracking-wider text-muted-foreground">
          {Math.max(0, msgs.length - 1)} messages
        </div>
      </div>

      <div className="relative z-10 flex-1 space-y-4 overflow-y-auto pb-2" aria-live="polite">
        {msgs.map((message, index) => (
          <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end animate-in fade-in slide-in-from-bottom-2" : "animate-in fade-in slide-in-from-bottom-2"}>
            {message.role === "user" ? (
              <div className="max-w-[86%] rounded-[1.35rem] rounded-br-md bg-violet-grad px-4 py-3 text-sm leading-relaxed text-primary-foreground shadow-card">
                {message.text}
              </div>
            ) : (
              <div className="group flex max-w-[97%] items-start gap-2.5">
                <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-grad shadow-card">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1 rounded-[1.35rem] rounded-bl-md border border-border bg-gradient-to-br from-card to-secondary/20 px-4 py-3 shadow-card">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
                      <Sparkles className="h-3 w-3" /> Copilot
                    </div>
                    <button
                      type="button"
                      onClick={() => copyMessage(message.text, index)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground opacity-70 transition hover:bg-secondary hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label="Copy response"
                    >
                      {copiedIndex === index ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <div className="whitespace-pre-line text-sm leading-relaxed text-foreground">{message.text}</div>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <section className="relative z-10 mt-4">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          <WandSparkles className="h-3.5 w-3.5 text-accent" /> Suggested questions
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK_PROMPTS.map((prompt, index) => {
            const PromptIcon = promptIcons[index % promptIcons.length];
            return (
              <button
                key={prompt}
                onClick={() => ask(prompt)}
                disabled={loading}
                className="group flex min-w-[13rem] items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 active:scale-[0.98] disabled:opacity-50"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent transition group-hover:scale-110">
                  <PromptIcon className="h-4 w-4" />
                </div>
                <span className="line-clamp-2 text-xs leading-relaxed text-foreground">{prompt}</span>
              </button>
            );
          })}
        </div>
      </section>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(input);
        }}
        className="sticky bottom-2 z-30 mt-3 rounded-[1.4rem] border border-accent/20 bg-card/95 p-2 shadow-elevated backdrop-blur-xl"
      >
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1 px-2 py-1">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value.slice(0, 320))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  ask(input);
                }
              }}
              rows={1}
              placeholder={loading ? "Reading your data…" : "Ask about spending, debt, bills, goals, or payday…"}
              disabled={loading}
              aria-label="Ask Wealthpilot Copilot"
              className="max-h-28 min-h-10 w-full resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-accent" /> Uses saved app data</span>
              <span>{input.length}/320</span>
            </div>
          </div>
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-2xl bg-violet-grad shadow-card transition active:scale-90"
            disabled={loading || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>

      <p className="relative z-10 mt-2 px-3 text-center text-[9px] leading-relaxed text-muted-foreground">
        Wealthpilot provides calculations and rules from saved app data, not personalized investment or credit-product advice.
      </p>
    </div>
  );
}
