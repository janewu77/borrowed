from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from pydantic import BaseModel, TypeAdapter

from borrowed_backend.data.store import InMemoryStore


@dataclass(frozen=True)
class ToolDef:
    name: str
    description: str
    input: type[BaseModel]
    output: Any
    scope: str
    internal: bool
    external: bool
    handler: Callable[..., Awaitable[Any]]


REGISTRY: dict[str, ToolDef] = {}


def tool(*, name, description, input, output, scope="read", internal=True, external=True):
    def register(handler):
        if name in REGISTRY:
            raise ValueError(f"Duplicate tool: {name}")
        REGISTRY[name] = ToolDef(name, description, input, output, scope, internal, external, handler)
        return handler
    return register


async def invoke(name: str, store: InMemoryStore, payload: Any) -> Any:
    definition = REGISTRY[name]
    request = definition.input.model_validate(payload)
    result = await definition.handler(store, request)
    return TypeAdapter(definition.output).validate_python(result)
