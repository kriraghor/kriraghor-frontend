// Regenerate src/lib/api/schema.d.ts from the backend's OpenAPI document (ADR-002).
//   npm run api:sync                                  ../kriraghor-backend/openapi.json (sibling repo)
//   API_SPEC=https://api.staging.kriraghor.com/api/docs/openapi.json npm run api:sync
import { execFileSync } from "node:child_process";
import path from "node:path";

const spec = process.env.API_SPEC || "../kriraghor-backend/openapi.json";
// The package's exports map hides bin/, so call the CLI file by path.
const cli = path.join(process.cwd(), "node_modules", "openapi-typescript", "bin", "cli.js");
execFileSync(process.execPath, [cli, spec, "-o", "src/lib/api/schema.d.ts"], { stdio: "inherit" });
