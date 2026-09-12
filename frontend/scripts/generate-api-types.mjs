import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import openapiTS, { astToString } from "openapi-typescript";

// Export directly from Pydantic so SSE models are included without a running server.
const raw = execFileSync(process.env.BACKEND_PYTHON ?? "../backend/.venv/bin/python",
  ["scripts/export_contract.py"], { cwd: "../backend", env: { ...process.env, PYTHONPATH: "src" }, encoding: "utf8" });
const output = astToString(await openapiTS(JSON.parse(raw), { defaultNonNullable: false }));
writeFileSync("lib/openapi.generated.ts", output);
