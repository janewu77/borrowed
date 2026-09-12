"""Export HTTP and SSE schemas from the canonical Pydantic models."""
import json

from borrowed_backend.agents.state import Turn
from borrowed_backend.api.sse import EVENT_ADAPTER
from borrowed_backend.main import create_app

schema = create_app().openapi()
events = EVENT_ADAPTER.json_schema(ref_template="#/components/schemas/{model}")
schema["components"]["schemas"].update(events.pop("$defs"))
schema["components"]["schemas"]["BorrowerEvent"] = events
schema["components"]["schemas"]["Turn"] = Turn.model_json_schema()
print(json.dumps(schema))
