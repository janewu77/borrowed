import { execFileSync } from "node:child_process";

const schemaUrl = process.env.API_SCHEMA_URL ?? "http://localhost:8000/openapi.json";

// Backend must expose its Pydantic/OpenAPI projection before this command is run.
// The checked-in contract file lets the frontend compile until both applications
// are available locally; this command replaces it from the canonical schema.
execFileSync(
  "npx",
  ["openapi-typescript", schemaUrl, "--output", "lib/openapi.generated.ts"],
  { stdio: "inherit" },
);
