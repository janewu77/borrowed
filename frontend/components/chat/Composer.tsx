"use client";

import { FormEvent, useState } from "react";

export function Composer({ disabled, onSend, placeholder }: {
  disabled: boolean;
  onSend: (text: string) => void;
  placeholder: string;
}) {
  const [text, setText] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
  }
  return <form className="composer" onSubmit={submit}>
    <div className="composer__inner composer__inner--text">
      <textarea aria-label="Your message" disabled={disabled} onChange={event => setText(event.target.value)}
        placeholder={placeholder} value={text} />
      <button disabled={disabled || !text.trim()} type="submit">Send</button>
    </div>
  </form>;
}
