// Regenerate src/lib/api/schema.d.ts from the backend's OpenAPI document (ADR-002).
//   npm run api:sync                 ../kriraghor-backend/openapi.json (sibling repo)
//   API_SPEC=<url> npm run api:sync
// openapi-typescript needs TypeScript 5, while Expo SDK 57 uses TypeScript 6, so it runs through
// npx in its own environment instead of being a dev dependency.
import { execSync } from "node:child_process";

const spec = process.env.API_SPEC || "../kriraghor-backend/openapi.json";
execSync(`npx --yes -p openapi-typescript@7.13.0 -p typescript@5.9.3 openapi-typescript "${spec}" -o src/lib/api/schema.d.ts`, { stdio: "inherit" });
