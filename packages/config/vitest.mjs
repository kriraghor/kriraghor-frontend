// Vitest preset: jsdom, the "@" alias to the app's src, tests next to the code in src/**.
import path from "node:path";

/**
 * @param {string} dir the app folder (its src/ is the "@" alias)
 * @returns {import("vitest/config").UserConfig}
 */
export function vitestPreset(dir) {
  return {
    resolve: { alias: { "@": path.resolve(dir, "src") } },
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
  };
}
