"use client";

import { FormEvent, useRef, useState } from "react";

export function Composer({ disabled, onSend, placeholder }: {
  disabled: boolean;
  onSend: (text: string, image?: File) => void;
  placeholder: string;
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | undefined>();
  const fileInput = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if ((!value && !image) || disabled) return;
    onSend(value, image);
    setText("");
    setImage(undefined);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer__inner">
        <input
          accept="image/*"
          aria-hidden="true"
          className="visually-hidden"
          onChange={(event) => setImage(event.target.files?.[0])}
          ref={fileInput}
          tabIndex={-1}
          type="file"
        />
        <button aria-label="Attach a photo" className="attach" disabled={disabled} onClick={() => fileInput.current?.click()} type="button">+</button>
        <textarea
          aria-label="Your message"
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          placeholder={image ? image.name : placeholder}
          value={text}
        />
        <button disabled={disabled} type="submit">Send</button>
      </div>
    </form>
  );
}
