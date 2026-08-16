"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { useFilters } from "@/lib/filters-context";

type Message = {
  role: "user" | "assistant";
  text: string;
  basedOn?: string;
};

export function QaPanel({ configured }: { configured: boolean }) {
  const { records, dateRangeLabel, departmentLabel } = useFilters();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const basedOn = `Based on: ${dateRangeLabel} · ${departmentLabel}`;

  async function submit() {
    const trimmed = question.trim();
    if (!trimmed || pending || !configured) return;

    setError(null);
    setQuestion("");
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setPending(true);

    try {
      const response = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          dateRange: dateRangeLabel,
          department: departmentLabel,
          records,
        }),
      });

      const payload = (await response.json()) as {
        answer?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "The assistant could not answer.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: payload.answer ?? "",
          basedOn,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <aside className="flex h-full min-h-[32rem] w-full flex-col bg-white xl:min-h-screen xl:border-l xl:border-border">
      <div className="border-b border-border px-4 py-4">
        <h2 className="text-sm font-semibold text-foreground">Ask the data</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          Answers use only the currently filtered records.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!configured ? (
          <div className="rounded-md border border-border bg-background px-3 py-3 text-xs leading-5 text-muted">
            Add your Grok key as <code className="font-medium text-foreground">GROK_API_KEY</code> in{" "}
            <code className="font-medium text-foreground">.env.local</code>, then restart the
            dev server.
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs leading-5 text-muted">
            Try “Which department is furthest from target?” or “Is attrition in the
            red?”
          </p>
        ) : null}

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={
              message.role === "user"
                ? "ml-6 rounded-md bg-navy px-3 py-2 text-xs leading-5 text-white"
                : "mr-2 rounded-md border border-border bg-background px-3 py-2 text-xs leading-5 text-foreground"
            }
          >
            <p className="whitespace-pre-wrap">{message.text}</p>
            {message.role === "assistant" && message.basedOn ? (
              <p className="mt-2 inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted">
                {message.basedOn}
              </p>
            ) : null}
          </div>
        ))}

        {pending ? (
          <div className="mr-2 animate-pulse rounded-md border border-border bg-background px-3 py-3">
            <div className="h-2.5 w-3/4 rounded bg-slate-200" />
            <div className="mt-2 h-2.5 w-1/2 rounded bg-slate-200" />
          </div>
        ) : null}

        {error ? (
          <p className="text-xs text-rag-red">{error}</p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="border-t border-border p-4">
        <div className="flex items-end gap-2">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            disabled={!configured || pending}
            placeholder={configured ? "Ask about the current slice…" : "API key required"}
            className="min-h-[72px] w-full resize-none rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted disabled:bg-background disabled:text-muted focus:border-navy"
          />
          <button
            type="submit"
            disabled={!configured || pending || !question.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-navy text-white disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send question"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="mt-2 text-[10px] text-muted">{basedOn}</p>
      </form>
    </aside>
  );
}
