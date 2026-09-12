"use client";

import type { SseEvent } from "../../lib/api-types";

const sizeChips = [34, 36, 38, 40, 42, 44];

export function AgentQuestion({
  question,
  onReply,
}: {
  question: Extract<SseEvent, { event: "question" }>;
  onReply: (text: string) => void;
}) {
  const needsSize = question.data.fields.includes("sizes_eu");

  return (
    <section aria-live="polite" className="agent-question" role="status">
      <small>still needed</small>
      <p>{question.data.text}</p>
      <div className="chips" aria-label="Missing details">
        {question.data.fields.map((field) => <span key={field}>{field.replaceAll("_", " ")}</span>)}
      </div>
      {needsSize && (
        <div className="chips" aria-label="Quick size replies">
          {sizeChips.map((size) => (
            <button key={size} onClick={() => onReply(`My EU size is ${size}`)} type="button">EU {size}</button>
          ))}
        </div>
      )}
    </section>
  );
}
