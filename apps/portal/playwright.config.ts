import { defineConfig } from "@playwright/test";
import { playwrightPreset } from "@kriraghor/config/playwright";

export default defineConfig(playwrightPreset(3002));
