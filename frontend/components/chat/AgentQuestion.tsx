"use client";

import { useState } from "react";
import type { SseEvent } from "../../lib/api-types";

const sizeChips = [34, 36, 38, 40, 42, 44];
const cityOptions = ["Hamburg", "Bremen", "Hannover", "Kiel", "Lübeck"];
const occasionOptions = [
  { value: "", label: "No preference" },
  { value: "gala", label: "Gala" },
  { value: "party", label: "Party" },
  { value: "wedding", label: "Wedding" },
  { value: "formal", label: "Formal event" },
  { value: "engagement", label: "Engagement" },
  { value: "weekend", label: "Weekend" },
];
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
  const needsCity = question.data.fields.includes("city");
  const needsWearDate = question.data.fields.includes("wear_date");
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedWearDate, setSelectedWearDate] = useState("");
  const [selectedOccasion, setSelectedOccasion] = useState("");
  const canSubmit = (!needsWearDate || Boolean(selectedWearDate)) &&
    (!needsCity || selectedCity !== null) && (!needsSize || selectedSize !== null);

  function submitSelection() {
    if (!canSubmit || disabled) return;
    const reply = [
      selectedWearDate ? `My wear date is ${selectedWearDate}` : "",
      selectedCity ? `My city is ${selectedCity}` : "",
      selectedSize !== null ? `My EU size is ${selectedSize}` : "",
      selectedOccasion ? `The occasion is ${selectedOccasion}` : "",
    ]
      .filter(Boolean)
      .join(". ");
    onReply(reply);
  }

  return (
    <section aria-label="A question from MORE" aria-live="polite" className="agent-question" role="group">
      <div className="agent-question__heading"><small>MORE</small><span>A few quick details</span></div>
      <p>{question.data.text}</p>
      <p className="agent-question__missing">Please tell us</p>
      <div className="chips" aria-label="Missing details">
        {question.data.fields.map((field) => <span key={field}>{fieldLabels[field] ?? field.replaceAll("_", " ")}</span>)}
      </div>
      <div className="agent-question__choices">
        {needsWearDate && <label className="agent-question__select">Wear date
          <input disabled={disabled} onChange={event => setSelectedWearDate(event.target.value)} type="date" value={selectedWearDate} />
        </label>}
        {needsCity && <label className="agent-question__select">City
          <select disabled={disabled} onChange={event => setSelectedCity(event.target.value || null)} value={selectedCity ?? ""}>
            <option disabled value="">Select a city</option>
            {cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
        </label>}
        {needsSize && <div><p>Choose your EU size</p><div className="chips" aria-label="Quick size replies">
          {sizeChips.map((size) => (
            <button aria-pressed={selectedSize === size} disabled={disabled} key={size} onClick={() => setSelectedSize(size)} type="button">EU {size}</button>
          ))}
        </div></div>}
        <label className="agent-question__select">Event <span>optional</span>
          <select disabled={disabled} onChange={event => setSelectedOccasion(event.target.value)} value={selectedOccasion}>
            {occasionOptions.map((occasion) => <option key={occasion.value} value={occasion.value}>{occasion.label}</option>)}
          </select>
        </label>
        <button className="agent-question__continue" disabled={disabled || !canSubmit} onClick={submitSelection} type="button">Continue</button>
      </div>
    </section>
  );
}
