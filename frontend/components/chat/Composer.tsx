"use client";

import { FormEvent, KeyboardEvent, useLayoutEffect, useRef, useState } from "react";

export function Composer({ disabled, onSend, placeholder }: {
  disabled: boolean;
  onSend: (text: string) => void;
  placeholder: string;
}) {
  const [text, setText] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);

  function resize(field: HTMLTextAreaElement | null) {
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 176)}px`;
  }

  useLayoutEffect(() => { resize(textarea.current); }, [text]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }
  return <form className="composer" onSubmit={submit}>
    <div className="composer__inner composer__inner--text">
      <textarea aria-label="Your message" disabled={disabled} onChange={event => setText(event.target.value)}
        onInput={event => resize(event.currentTarget)} onKeyDown={onKeyDown} placeholder={placeholder} ref={textarea} rows={1} value={text} />
      <button disabled={disabled || !text.trim()} type="submit">Send</button>
    </div>
  </form>;
}
