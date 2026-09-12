import asyncio
import json

import httpx
import pytest
from openai import AsyncOpenAI
from pydantic import ValidationError

from borrowed_backend.agents.llm import OpenAILLM
from borrowed_backend.agents.state import Extraction


def response_payload(text=None, status="completed"):
    content = [{"type": "output_text", "text": text, "annotations": []}] if text is not None else [
        {"type": "refusal", "refusal": "Unable to extract"}]
    return {"id": "resp_test", "object": "response", "created_at": 0, "status": status,
            "model": "test-model", "output": [{"type": "message", "id": "msg_test",
            "role": "assistant", "status": "completed", "content": content}],
            "parallel_tool_calls": False, "tools": [], "tool_choice": "auto"}


def make_llm(settings, handler):
    llm = OpenAILLM(settings.model_copy(update={"openai_model": "test-model"}))
    # A mock transport exercises the real SDK without credentials or network calls.
    llm.client = AsyncOpenAI(api_key="test-only", max_retries=0,
                            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    llm.settings = settings.model_copy(update={"openai_model": "test-model", "openai_api_key": "test-only"})
    return llm


def test_responses_structured_output_contract(settings):
    seen = []
    def handler(request):
        seen.append(json.loads(request.content))
        return httpx.Response(200, json=response_payload(Extraction(city="Hamburg", sizes_eu=[38]).model_dump_json()))
    async def run():
        llm = make_llm(settings, handler)
        try:
            result = await llm.extract({"text": "Hamburg EU 38"})
            assert result.city == "Hamburg" and result.sizes_eu == [38]
        finally:
            await llm.close()
    asyncio.run(run())
    payload = seen[0]
    assert payload["model"] == "test-model"
    assert payload["store"] is False
    assert "tools" not in payload
    fmt = payload["text"]["format"]
    assert fmt["type"] == "json_schema" and fmt["strict"] is True
    def check(schema):
        if isinstance(schema, dict):
            assert "default" not in schema
            if schema.get("type") == "object":
                assert schema["additionalProperties"] is False
                assert set(schema["required"]) == set(schema["properties"])
            for value in schema.values():
                check(value)
        elif isinstance(schema, list):
            for value in schema:
                check(value)
    check(fmt["schema"])


@pytest.mark.parametrize("body", [response_payload(), response_payload('{}', "incomplete"),
                                    response_payload('{"sizes_eu":[-1]}'), response_payload('not-json')])
def test_invalid_refused_or_incomplete_extraction(settings, body):
    async def run():
        llm = make_llm(settings, lambda request: httpx.Response(200, json=body))
        try:
            with pytest.raises((ValueError, ValidationError)):
                await llm.extract({"text": "hello"})
        finally:
            await llm.close()
    asyncio.run(run())


@pytest.mark.parametrize("status", ["completed", "incomplete", "failed"])
def test_responses_text_stream(settings, status):
    final = response_payload("Available results", status)
    frames = [
        {"type": "response.created", "response": response_payload("", "in_progress"), "sequence_number": 0},
        {"type": "response.output_text.delta", "delta": "Available results", "item_id": "msg_test",
         "output_index": 0, "content_index": 0, "sequence_number": 1},
        {"type": f"response.{status}", "response": final, "sequence_number": 2},
    ]
    encoded = "".join(f"event: {frame['type']}\ndata: {json.dumps(frame)}\n\n" for frame in frames)
    async def run():
        llm = make_llm(settings, lambda request: httpx.Response(
            200, headers={"content-type": "text/event-stream"}, text=encoded))
        chunks = []
        try:
            async for chunk in llm.text_stream({"kind": "results"}):
                chunks.append(chunk)
            assert status == "completed"
        except ValueError:
            assert status != "completed"
        finally:
            await llm.close()
        assert chunks == ["Available results"]
    asyncio.run(run())
