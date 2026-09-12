import asyncio
import json
from typing import AsyncIterator, Protocol

from openai import AsyncOpenAI

from borrowed_backend.config import Settings
from .prompts import COMPOSE, EXTRACT
from .state import Extraction


class LLMNotConfigured(RuntimeError):
    pass


class BorrowerLLM(Protocol):
    async def extract(self, context: dict) -> Extraction: ...
    def text_stream(self, context: dict) -> AsyncIterator[str]: ...
    async def close(self) -> None: ...


class OpenAILLM:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client: AsyncOpenAI | None = None

    def _client(self) -> AsyncOpenAI:
        if not self.settings.openai_api_key or not self.settings.openai_model:
            raise LLMNotConfigured("OPENAI_API_KEY and OPENAI_MODEL must be configured")
        if self.client is None:
            self.client = AsyncOpenAI(
                api_key=self.settings.openai_api_key.get_secret_value(),
                timeout=self.settings.llm_timeout_s, max_retries=0,
            )
        return self.client

    async def extract(self, context: dict) -> Extraction:
        async with asyncio.timeout(self.settings.llm_timeout_s):
            response = await self._client().responses.parse(
                model=self.settings.openai_model, max_output_tokens=2500,
                instructions=EXTRACT, input=json.dumps(context, ensure_ascii=False),
                text_format=Extraction, store=False,
            )
        if response.status != "completed" or response.output_parsed is None:
            raise ValueError("Expected a complete structured extraction")
        return Extraction.model_validate(response.output_parsed)

    async def text_stream(self, context: dict) -> AsyncIterator[str]:
        async with asyncio.timeout(self.settings.llm_timeout_s):
            async with self._client().responses.stream(
                model=self.settings.openai_model, max_output_tokens=2000,
                instructions=COMPOSE, input=json.dumps(context, ensure_ascii=False), store=False,
            ) as stream:
                async for event in stream:
                    if event.type in ("response.failed", "response.incomplete", "error"):
                        raise ValueError("Text response did not complete")
                    if event.type == "response.output_text.delta":
                        yield event.delta
                response = await stream.get_final_response()
                if response.status != "completed" or not response.output_text:
                    raise ValueError("Expected a complete text response")

    async def close(self) -> None:
        if self.client is not None:
            await self.client.close()
