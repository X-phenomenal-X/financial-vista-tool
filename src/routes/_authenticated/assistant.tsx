import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useAllData } from "@/lib/queries";
import { coachAnswer, QUICK_PROMPTS } from "@/lib/coach";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [{ title: "Assistant — Money Map" }, { name: "description", content: "Your built-in financial coach — answers from live data." }] }),
  component: AssistantPage,
});

interface Msg { role: "user" | "coach"; text: string; }

function AssistantPage() {
  const { user } = useAuth();
  const ctx = useAllData(user?.id);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "coach", text: "Hey Abhi — I'm your money coach. I read your live app data. Ask me anything, or tap a quick prompt below." }]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  function ask(text: string) {
    if (!text.trim()) return;
    const answer = coachAnswer(text, ctx);
    setMsgs((m) => [...m, { role: "user", text }, { role: "coach", text: answer }]);
    setInput("");
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col pb-4">
      <header className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-grad shadow-card"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
        <div><h1 className="font-display text-xl leading-tight">Coach</h1><p className="text-xs text-muted-foreground">Built-in · works offline · AI upgrade coming later</p></div>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "max-w-[85%] rounded-2xl bg-violet-grad px-4 py-2.5 text-sm text-primary-foreground" : "max-w-[95%] whitespace-pre-line text-sm text-foreground"}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((p) => (
          <button key={p} onClick={() => ask(p)} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">{p}</button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="mt-3 flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your money…" />
        <Button type="submit" size="icon" className="bg-violet-grad"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}