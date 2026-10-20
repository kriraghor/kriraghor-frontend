// Copies src/tokens.ts into the mobile app (a separate repo) with a header naming its source.
// Usage: npm run tokens:copy -w @kriraghor/tokens -- ../../../kriraghor-mobile
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const app = process.argv[2];
if (!app) {
  console.error("Give the mobile app folder, e.g. npm run tokens:copy -- ../../../kriraghor-mobile");
  process.exit(1);
}
const source = readFileSync(join(here, "..", "src", "tokens.ts"), "utf8");
const target = resolve(process.cwd(), app, "src", "constants", "tokens.ts");
writeFileSync(target, `// Generated from kriraghor-frontend packages/tokens/src/tokens.ts. Do not edit here.\n${source}`);
console.log(`tokens.ts → ${target}`);
