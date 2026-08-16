import type { RagStatus } from "@/lib/types";

const COLORS: Record<RagStatus | "neutral", string> = {
  green: "bg-rag-green",
  amber: "bg-rag-amber",
  red: "bg-rag-red",
  neutral: "bg-slate-300",
};

export function StatusDot({
  status,
}: {
  status: RagStatus | "neutral";
}) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${COLORS[status]}`}
    />
  );
}
