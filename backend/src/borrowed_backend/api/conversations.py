import asyncio
from contextlib import suppress
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import StreamingResponse
from pydantic import ValidationError

from borrowed_backend.agents.borrower_graph import BorrowerGraph
from borrowed_backend.agents.llm import LLMNotConfigured
from borrowed_backend.agents.state import ConversationState, Turn
from borrowed_backend.domain.errors import PersistenceFailure
from borrowed_backend.domain.models import FrozenModel
from .sse import Done, Error, encode

router = APIRouter()
HEARTBEAT_SECONDS = 15


class CreateConversation(FrozenModel):
    role: Literal["borrower"] = "borrower"


@router.post("/api/conversations", status_code=201)
async def create_conversation(payload: CreateConversation, request: Request):
    conversation = ConversationState(conversation_id=f"conv-{uuid4().hex}")
    await request.app.state.store.save_conversation(conversation)
    return {"conversation_id": conversation.conversation_id, "role": conversation.role}


@router.get("/api/debug/conversations/{conversation_id}")
async def debug_conversation(conversation_id: str, request: Request):
    store = request.app.state.store
    if not store.settings.debug:
        raise HTTPException(status_code=404, detail="Not found")
    if conversation_id not in store.conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return store.conversations[conversation_id]


@router.post("/api/conversations/{conversation_id}/turn", openapi_extra={
    "requestBody": {"required": True, "content": {
        kind: {"schema": Turn.model_json_schema()} for kind in
        ("application/json", "multipart/form-data")
    }},
    "responses": {"200": {"description": "SSE events ending in done",
                           "content": {"text/event-stream": {"schema": {"type": "string"}}}}},
})
async def conversation_turn(conversation_id: str, request: Request):
    store = request.app.state.store
    if conversation_id not in store.conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    content_type = request.headers.get("content-type", "").split(";", 1)[0]
    try:
        if content_type == "application/json":
            turn = Turn.model_validate(await request.json())
        elif content_type in ("multipart/form-data", "application/x-www-form-urlencoded"):
            async with request.form(max_files=0, max_fields=5, max_part_size=32768) as form:
                if len(form.multi_items()) != len(form):
                    raise HTTPException(status_code=422, detail="Duplicate fields are not supported")
                turn = Turn.model_validate(dict(form))
        else:
            raise HTTPException(status_code=415, detail="Use application/json or multipart/form-data")
    except ValidationError as exc:
        raise RequestValidationError(exc.errors()) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid turn body") from exc
    if turn.intent == "book" and turn.text.strip():
        raise HTTPException(status_code=422, detail="Send booking confirmation without text; send changes as a message first")

    async def stream():
        queue = asyncio.Queue(maxsize=100)

        async def produce():
            try:
                async with store.conversation_locks[conversation_id]:
                    await BorrowerGraph(store, request.app.state.borrower_llm).run(
                        conversation_id, turn, queue.put)
            except LLMNotConfigured:
                await queue.put(Error(code="LLM_NOT_CONFIGURED",
                                      message="请在服务器配置 OPENAI_API_KEY 和 OPENAI_MODEL 后重试。"))
            except TimeoutError:
                await queue.put(Error(code="LLM_TIMEOUT", message="模型调用超时，请重试本轮消息。"))
            except PersistenceFailure:
                await queue.put(Error(code="PERSISTENCE_FAILED", message=(
                    "状态暂时无法保存。若已收到 booking_claim，预约已成功；否则请用原确认请求重试。")))
            except (ValidationError, OverflowError):
                await queue.put(Error(code="INVALID_SLOTS", message="请提供明确的穿着日期、最后穿着日、城市和 EU 尺码后重试。"))
            except Exception:
                await queue.put(Error(code="TURN_FAILED", message=(
                    "暂时无法完成本轮请求，请重试；已返回的推荐仍可明确确认预约，未收到预约成功事件请勿视为成功。")))
            finally:
                # Cancellation must not block behind a disconnected reader's full queue.
                if not asyncio.current_task().cancelling():
                    await queue.put(Done(conversation_id=conversation_id))

        producer = asyncio.create_task(produce())
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
                except TimeoutError:
                    yield ": ping\n\n"
                    continue
                yield encode(event)
                if isinstance(event, Done):
                    break
        finally:
            producer.cancel()
            with suppress(asyncio.CancelledError):
                await producer

    return StreamingResponse(stream(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache", "X-Accel-Buffering": "no",
    })
