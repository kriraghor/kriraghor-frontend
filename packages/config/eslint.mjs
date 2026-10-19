// The eslint setup every app uses: Next.js core web vitals and TypeScript rules, plus the workspace
// boundaries (apps never import another app; nobody reaches into another package's internals).
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export const boundaries = {
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          { group: ["**/apps/*", "**/apps/*/**"], message: "Apps never import from another app. Move shared code into packages/." },
          { group: ["@kriraghor/*/src/**", "**/packages/*/src/**"], message: "Import a package by its name and public exports, not its files." },
        ],
      },
    ],
  },
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  boundaries,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
