"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiUrl, createConversation } from "../../lib/api";
import type { ConversationRole, SearchHit, SseEvent, Turn } from "../../lib/api-types";
import { readSse } from "../../lib/sse";
import { AvailabilityTimeline } from "../availability/AvailabilityTimeline";
import { BookingConfirm } from "../cards/BookingConfirm";
import { BookingReceipt } from "../cards/Receipt";
import { ResultGrid } from "../cards/ResultCard";
import { AgentQuestion } from "./AgentQuestion";
import { Composer } from "./Composer";

type Item = SseEvent | { event: "message"; data: { text: string } };
type Selection = { hit: SearchHit; resultId: string };
type HistoryItem = { id: string; title: string; items: Item[]; resultId: string | null; retry: Turn | null };

function conversationTitle(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 56 ? `${compact.slice(0, 56).trimEnd()}…` : compact;
}

export function ChatStream({ role }: { role: ConversationRole }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState<Turn | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [attempt, setAttempt] = useState(0);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const resultsAnchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (role !== "borrower") { setBusy(false); return; }
    const abort = new AbortController();
    setBusy(true);
    setError("");
    createConversation("borrower", abort.signal).then(({ conversation_id }) => {
      if (!abort.signal.aborted) setConversationId(conversation_id);
    }).catch(() => {
      if (!abort.signal.aborted) setError("Could not connect. Check the backend and try again.");
    }).finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => { abort.abort(); controller.current?.abort(); };
  }, [role, attempt]);

  useEffect(() => {
    if (!conversationId) return;
    setHistory(entries => entries.map(entry => entry.id === conversationId
      ? { ...entry, items, resultId, retry }
      : entry));
  }, [conversationId, items, resultId, retry]);

  useEffect(() => {
    const scroll = bottom.current;
    if (!scroll) return;
    const frame = requestAnimationFrame(() => {
      const result = resultsAnchor.current;
      if (result && resultId) {
        const top = scroll.scrollTop + result.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 24;
        scroll.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        return;
      }
      scroll.scrollTo({ top: scroll.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [items, error, resultId]);

  function startNewConversation() {
    if (busy) return;
    controller.current?.abort();
    setConversationId(null);
    setItems([]);
    setError("");
    setRetry(null);
    setResultId(null);
    setSelection(null);
    setAttempt(value => value + 1);
  }

  function selectConversation(entry: HistoryItem) {
    if (busy || entry.id === conversationId) return;
    controller.current?.abort();
    setConversationId(entry.id);
    setItems(entry.items);
    setResultId(entry.resultId);
    setRetry(entry.retry);
    setSelection(null);
    setError("");
  }

  async function send(payload: Turn) {
    if (!conversationId || inFlight.current) return;
    inFlight.current = true;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setRetry(null);
    setSelection(null);
    if (payload.intent !== "book") setResultId(null);
    if (payload.intent !== "book" && payload.text?.trim()) {
      const title = conversationTitle(payload.text);
      setHistory(entries => entries.some(entry => entry.id === conversationId)
        ? entries
        : [{ id: conversationId, title, items: [], resultId: null, retry: null }, ...entries]);
    }
    setItems(previous => [...previous, { event: "message", data: {
      text: payload.intent === "book" ? `Confirm reservation: ${payload.garment_id}` : payload.text ?? "",
    } }]);
    let claimed = false;
    try {
      const response = await fetch(apiUrl(`/api/conversations/${encodeURIComponent(conversationId)}/turn`), {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(payload), signal: abort.signal,
      });
      if (!response.ok) {
        if (response.status === 404) setConversationId(null);
        throw new Error(`Request failed (${response.status}). Please try again.`);
      }
      if (!response.body) throw new Error("The server returned no event stream.");
      for await (const event of readSse(response.body)) {
        if (event.event === "results") setResultId(event.data.result_id);
        if (event.event === "booking_claim") { claimed = true; setResultId(null); setRetry(null); }
        if (event.event === "error") {
          setError(`${event.data.code}: ${event.data.message}`);
          if (["BOOKING_CONFLICT", "CONFIRMATION_REQUIRED"].includes(event.data.code)) {
            setResultId(null);
          } else if (!claimed && event.data.recoverable) setRetry(payload);
        }
        setItems(previous => {
          const last = previous.at(-1);
          if (event.event === "token" && last?.event === "token") {
            return [...previous.slice(0, -1), { event: "token", data: { text: last.data.text + event.data.text } }];
          }
          return [...previous, event];
        });
      }
    } catch (failure) {
      if (!abort.signal.aborted) {
        setError(claimed ? "Reservation confirmed. The connection ended before the conversation finished."
          : `${failure instanceof Error ? failure.message : "Connection failed."} ${payload.intent === "book" ? "Reservation status is unconfirmed; retry the same request to recover it." : "Retry your message to continue."}`);
        if (!claimed) setRetry(payload);
      }
    } finally {
      inFlight.current = false;
      if (!abort.signal.aborted) setBusy(false);
    }
  }

  if (role !== "borrower") return <main className="page"><h1>Listing is not available yet</h1><Link href="/find">Find a garment</Link></main>;
  return (
    <main className="chat-shell"><div className="chat-workspace">
      <aside className="conversation-history" aria-label="Conversations">
        <div className="conversation-history__heading">
          <p className="conversation-history__title">Conversations</p>
          <button aria-label="New conversation" className="new-conversation" disabled={busy} onClick={startNewConversation} title="New conversation" type="button">+</button>
        </div>
        {history.length > 0 && <section className="conversation-history__group">
          <p>Today</p>
          {history.map(entry => <button aria-current={entry.id === conversationId ? "page" : undefined}
            className={`conversation-history__item${entry.id === conversationId ? " active" : ""}`}
            disabled={busy} key={entry.id} onClick={() => selectConversation(entry)} type="button">{entry.title}</button>)}
        </section>}
      </aside>
      <div className="chat-main">
        <header className="chat-header"><Link className="brand" href="/">MORE</Link><span>Occasion wear</span></header>
        <div className="chat-scroll" ref={bottom}><div className="page chat">
          <section className="messages" aria-label="Conversation">
            {items.length === 0 && <section className="empty-state">
              <h1>What is the occasion?</h1><p>Tell me the event, city, date and your usual size. I will only show garments that can arrive in time.</p>
              <div className="starters">
                {[
                  "I have a gala this Friday",
                  "I'm attending a wedding in Sicily this September",
                  "I need a chic dress for a birthday dinner",
                  "I have a black-tie event next weekend",
                  "I'm going to a christening next month",
                  "I need something for a summer party",
                ].map((prompt) => <button disabled={busy || !conversationId} key={prompt} onClick={() => send({ text: prompt })}>{prompt}</button>)}
              </div>
            </section>}
            {items.map((item, index) => {
              if (item.event === "message" || item.event === "token") return <p key={index} className={`message message--${item.event === "message" ? "borrower" : "assistant"}`}>{item.data.text}</p>;
              if (item.event === "question") return <AgentQuestion disabled={busy} key={index} question={item} onReply={text => send({ text })} />;
              if (item.event === "results" && item.data.result_id !== resultId) return null;
              if (item.event === "results") return <div key={index} ref={resultsAnchor}>
                {!item.data.hits.length && <p role="status">No garments available. Try another wear date, city or size.</p>}
                <ResultGrid hits={item.data.hits} relaxed={item.data.relaxed ?? null} disabled={busy}
                  onReserve={hit => setSelection({ hit, resultId: item.data.result_id })} />
              </div>;
              if (item.event === "availability") return <AvailabilityTimeline key={index} {...item.data} />;
              if (item.event === "booking_claim") return <BookingReceipt key={index} booking={item.data.booking} />;
              return null;
            })}
            {busy && <p role="status">{conversationId ? "Working…" : "Connecting…"}</p>}
            {error && <p className="error" role="alert">{error}</p>}
            {!conversationId && !busy && <button onClick={() => setAttempt(value => value + 1)}>Reconnect</button>}
            {retry && conversationId && <button disabled={busy} onClick={() => send(retry)}>Retry same request</button>}
          </section>
          <Composer disabled={busy || !conversationId} onSend={text => send({ text })} placeholder="Your city, wear date and EU size…" />
        </div></div>
        {selection && <BookingConfirm hit={selection.hit} onCancel={() => setSelection(null)} onConfirm={() => send({
          intent: "book", garment_id: selection.hit.garment.id, confirmed: true, result_id: selection.resultId,
        })} />}
      </div>
    </div></main>
  );
}
