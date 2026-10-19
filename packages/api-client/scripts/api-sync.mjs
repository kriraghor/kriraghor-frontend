// Regenerate src/schema.d.ts from the backend's OpenAPI document (ADR-002). Run from the repo root:
//   npm run api:sync                                  kriraghor-backend/openapi.json, the sibling repo
//   API_SPEC=https://api.staging.kriraghor.com/api/docs/openapi.json npm run api:sync
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.join(here, "..");
// packages/api-client → kriraghor-frontend → the workspace folder that also holds kriraghor-backend.
const spec = process.env.API_SPEC || path.join(pkg, "..", "..", "..", "kriraghor-backend", "openapi.json");
// The package's exports map hides bin/, so resolve the CLI file by path (hoisted to the root node_modules).
const cli = path.join(path.dirname(createRequire(import.meta.url).resolve("openapi-typescript/package.json")), "bin", "cli.js");
execFileSync(process.execPath, [cli, spec, "-o", path.join(pkg, "src", "schema.d.ts")], { stdio: "inherit" });
