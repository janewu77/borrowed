import type { SseEvent } from "../../lib/api-types";

const sizeChips = [34, 36, 38, 40, 42, 44];
const fieldLabels: Record<string, string> = {
  city: "city",
  wear_date: "wear date",
  sizes_eu: "EU size",
};

export function AgentQuestion({
  question,
  disabled = false,
  onReply,
}: {
  disabled?: boolean;
  question: Extract<SseEvent, { event: "question" }>;
  onReply: (text: string) => void;
}) {
  const needsSize = question.data.fields.includes("sizes_eu");

  return (
    <section aria-label="A question from MORE" aria-live="polite" className="agent-question" role="group">
      <div className="agent-question__heading"><small>MORE</small><span>One quick question</span></div>
      <p>{question.data.text}</p>
      <p className="agent-question__missing">Please tell us</p>
      <div className="chips" aria-label="Missing details">
        {question.data.fields.map((field) => <span key={field}>{fieldLabels[field] ?? field.replaceAll("_", " ")}</span>)}
      </div>
      {needsSize && (
        <div className="chips" aria-label="Quick size replies">
          {sizeChips.map((size) => (
            <button disabled={disabled} key={size} onClick={() => onReply(`My EU size is ${size}`)} type="button">EU {size}</button>
          ))}
        </div>
      )}
    </section>
  );
}
