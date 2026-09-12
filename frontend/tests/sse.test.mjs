import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/sse.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { readSse } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
function stream(text) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  } });
}
async function collect(text) {
  const events = [];
  for await (const event of readSse(stream(text))) events.push(event);
  return events;
}
test("split UTF-8, CRLF, comments and done", async () => {
  const events = await collect(': ping\r\n\r\nevent: token\r\ndata: {"text":"汉堡"}\r\n\r\nevent: done\r\ndata: {"conversation_id":"c"}\r\n\r\n');
  assert.deepEqual(events.map(event => event.event), ["token", "done"]);
  assert.equal(events[0].data.text, "汉堡");
});
test("EOF without done is a recoverable transport failure", async () => {
  await assert.rejects(collect('event: token\ndata: {"text":"hello"}\n\n'), /before done/);
});
test("malformed events must not silently hide a booking result", async () => {
  await assert.rejects(collect('event: booking_claim\ndata: {broken}\n\nevent: done\ndata: {}\n\n'), SyntaxError);
});
test("business error remains an event even when done follows", async () => {
  const events = await collect('event: error\ndata: {"code":"BOOKING_CONFLICT","message":"Conflict","recoverable":true}\n\nevent: done\ndata: {"conversation_id":"c"}\n\n');
  assert.equal(events[0].data.code, "BOOKING_CONFLICT");
});
