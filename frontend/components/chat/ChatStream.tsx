"use client";

import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { apiUrl, ApiError, createConversation, publishListing } from "../../lib/api";
import type { ConversationRole, ListingDraft, SearchHit, SseEvent } from "../../lib/api-types";
import { readSse } from "../../lib/sse";
import { AvailabilityTimeline } from "../availability/AvailabilityTimeline";
import { BookingConfirm } from "../cards/BookingConfirm";
import { BookingReceipt } from "../cards/Receipt";
import { ListingDraftCard } from "../cards/ListingDraftCard";
import { ResultGrid } from "../cards/ResultCard";
import { AgentQuestion } from "./AgentQuestion";
import { Composer } from "./Composer";

type Status = "starting" | "idle" | "streaming" | "error";
type ChatItem =
  | { kind: "message"; role: "borrower" | "lender" | "assistant"; text: string }
  | { kind: "question"; event: Extract<SseEvent, { event: "question" }> }
  | { kind: "event"; event: Exclude<SseEvent["event"], "token" | "question" | "done">; data: unknown };

type State = { status: Status; conversationId: string | null; items: ChatItem[]; retryText: string | null };
type Action =
  | { type: "ready"; conversationId: string }
  | { type: "start"; text: string; role: ConversationRole }
  | { type: "event"; event: SseEvent }
  | { type: "failed"; text: string }
  | { type: "idle" };

const initialState: State = { status: "starting", conversationId: null, items: [], retryText: null };

function reducer(state: State, action: Action): State {
  if (action.type === "ready") return { ...state, conversationId: action.conversationId, status: "idle" };
  if (action.type === "start") {
    return {
      ...state,
      status: "streaming",
      retryText: action.text,
      items: [...state.items, { kind: "message", role: action.role, text: action.text }],
    };
  }
  if (action.type === "failed") return { ...state, status: "error", retryText: action.text };
  if (action.type === "idle") return { ...state, status: "idle" };
  const { event } = action;
  if (event.event === "token") {
    const last = state.items.at(-1);
    const token = event.data.text;
    if (last?.kind === "message" && last.role === "assistant") {
      return { ...state, items: [...state.items.slice(0, -1), { ...last, text: last.text + token }] };
    }
    return { ...state, items: [...state.items, { kind: "message", role: "assistant", text: token }] };
  }
  if (event.event === "question") return { ...state, items: [...state.items, { kind: "question", event }] };
  if (event.event === "error") {
    return event.data.recoverable
      ? { ...state, status: "error", retryText: state.retryText, items: [...state.items, { kind: "event", event: event.event, data: event.data }] }
      : { ...state, status: "idle", items: [...state.items, { kind: "event", event: event.event, data: event.data }] };
  }
  if (event.event === "done") return { ...state, status: "idle" };
  return { ...state, items: [...state.items, { kind: "event", event: event.event, data: event.data }] };
}

export function ChatStream({ role }: { role: ConversationRole }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [bookingHit, setBookingHit] = useState<SearchHit | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const retryText = state.retryText;

  useEffect(() => {
    const controller = new AbortController();
    createConversation(role, controller.signal)
      .then(({ conversation_id }) => dispatch({ type: "ready", conversationId: conversation_id }))
      .catch(() => dispatch({ type: "failed", text: "" }));
    return () => controller.abort();
  }, [role]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(async (text: string, options?: { idempotencyKey?: string; image?: File }) => {
    if (!state.conversationId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const displayText = text || (role === "borrower"
      ? "Reference photo attached — used to understand your style, not saved."
      : "Photo attached.");
    dispatch({ type: "start", text: displayText, role });

    try {
      let recoverableError = false;
      const form = new FormData();
      form.set("text", text);
      if (options?.idempotencyKey) form.set("idempotency_key", options.idempotencyKey);
      if (options?.image) form.set("image", options.image);
      const response = await fetch(apiUrl(`/api/conversations/${encodeURIComponent(state.conversationId)}/turn`), {
        method: "POST",
        body: form,
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      });
      if (!response.ok) throw new ApiError(`Turn failed (${response.status})`, response.status, null);
      if (!response.body) throw new Error("The server returned no event stream.");
      for await (const event of readSse(response.body)) {
        if (event.event === "error" && event.data.recoverable) recoverableError = true;
        dispatch({ type: "event", event });
      }
      if (!recoverableError) dispatch({ type: "idle" });
    } catch (error) {
      if (!controller.signal.aborted) dispatch({ type: "failed", text });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [role, state.conversationId]);

  const publish = useCallback(async (listingId: string) => {
    const { garment_id } = await publishListing(listingId);
    window.location.assign(`/garment/${encodeURIComponent(garment_id)}`);
  }, []);

  const title = role === "borrower" ? "What is the occasion?" : "Send one photo of the piece.";
  const description = role === "borrower"
    ? "Tell me the event, the date and your size. I will only show garments that can actually reach Hamburg in time."
    : "I write the listing from it — category, colour, silhouette, occasion, size and a suggested price. You correct whatever I got wrong.";
  const starters = role === "borrower"
    ? ["I have a wedding in Hamburg on Friday", "Gala next Saturday, size 38", "Christening on the 26th, not too formal"]
    : ["I want to list a garment"];
  const firstMessage = state.items.find((item) => item.kind === "message" && item.role === role);
  const conversationTitle = firstMessage?.kind === "message" ? firstMessage.text : "New conversation";

  return (
    <main className="chat-shell"><div className="chat-workspace">
      <aside className="conversation-history" aria-label="Conversations">
        <p className="conversation-history__title">Conversations</p>
        <section className="conversation-history__group">
          <p>Today</p>
          <button className="conversation-history__item" type="button">{conversationTitle}</button>
        </section>
      </aside>
      <div className="chat-main">
      <header className="chat-header">
        <Link className="brand" href="/">MORE</Link><span>Hamburg</span>
      </header>
      <div className="chat-scroll"><div className="page chat">
      <section className="messages" aria-label="Conversation">
        {state.items.length === 0 && (
          <section className="empty-state">
            <h1>{title}</h1><p>{description}</p>
            <div className="starters">{starters.map((starter) => <button key={starter} onClick={() => send(starter)} type="button">{starter}</button>)}</div>
          </section>
        )}
        {state.items.map((item, index) => {
          if (item.kind === "message") return <p className={`message message--${item.role}`} key={index}>{item.text}</p>;
          if (item.kind === "question") return <AgentQuestion key={index} onReply={send} question={item.event} />;
          if (item.event === "error") return <p className="error" key={index}>{(item.data as { message: string }).message}</p>;
          if (item.event === "results") {
            const data = item.data as Extract<SseEvent, { event: "results" }>["data"];
            return <ResultGrid hits={data.hits} key={index} onReserve={setBookingHit} relaxed={data.relaxed} />;
          }
          if (item.event === "availability") {
            const data = item.data as Extract<SseEvent, { event: "availability" }>["data"];
            return <AvailabilityTimeline feasibility={data.feasibility} garment={data.garment} key={index} />;
          }
          if (item.event === "listing_draft") return <ListingDraftCard draft={(item.data as { draft: ListingDraft }).draft} key={index} onPublish={publish} />;
          if (item.event === "booking_claim") return <BookingReceipt booking={(item.data as Extract<SseEvent, { event: "booking_claim" }> ["data"]).booking} key={index} />;
          return null;
        })}
        {state.status === "streaming" && <p className="stream-status">Looking through the catalogue…</p>}
        {state.status === "error" && retryText && <button onClick={() => send(retryText)} type="button">Try again</button>}
      </section>
      <Composer
        disabled={state.status === "starting" || state.status === "streaming"}
        onSend={(text, image) => send(text, { image })}
        placeholder={role === "borrower" ? "Describe the occasion…" : "Reply in your own words…"}
      />
      </div></div>
      {bookingHit && <BookingConfirm hit={bookingHit} onCancel={() => setBookingHit(null)} onConfirm={(idempotencyKey) => {
        setBookingHit(null);
        send(`Reserve ${bookingHit.garment.id} for ${bookingHit.feasibility.wear_from}.`, { idempotencyKey });
      }} />}
      </div></div>
    </main>
  );
}
