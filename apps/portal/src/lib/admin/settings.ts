import type { components } from "@kriraghor/api-client/schema";

/**
 * Fees and rules screen helpers (M03 §4). The server is the authority (types, ranges and
 * cross-key rules are checked again there); these give instant inline feedback and turn the
 * text in an input into the typed value the API expects.
 */
export type Setting = components["schemas"]["Setting"];
export type ChangeRequest = components["schemas"]["SettingsChangeRequest"];
export type SettingValue = Setting["value"];

export const CATEGORY_ORDER = ["fees", "booking", "market", "hire", "tournament", "esports", "gym", "gym_saas", "moderation", "money_limits", "payments", "risk", "accounts", "security", "simulator", "operations", "notifications"] as const;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

export type Parsed = { ok: true; value: SettingValue } | { ok: false; error: string };

/** Money is stored in poisha; people type taka. */
export const poishaToTaka = (poisha: number) => (poisha / 100).toFixed(2).replace(/\.00$/, "");
export const takaToPoisha = (taka: number) => Math.round(taka * 100);

function rangeError(setting: Setting, n: number, fmt: (x: number) => string = String): string | null {
  const { min, max } = setting;
  if (min != null && max != null && (n < min || n > max)) return `Between ${fmt(min)} and ${fmt(max)}`;
  if (min != null && n < min) return `At least ${fmt(min)}`;
  if (max != null && n > max) return `At most ${fmt(max)}`;
  return null;
}

const ok = (value: SettingValue): Parsed => ({ ok: true, value });
const fail = (error: string): Parsed => ({ ok: false, error });

/** Text in the input (or a boolean for toggles) → typed value, or a message to show under the field. */
export function parseInput(setting: Setting, raw: string | boolean | Record<string, string>): Parsed {
  switch (setting.valueType) {
    case "bool":
      return typeof raw === "boolean" ? ok(raw) : fail("Choose on or off");
    case "int":
    case "decimal": {
      const text = String(raw).trim();
      if (text === "" || Number.isNaN(Number(text))) return fail("Enter a number");
      const n = Number(text);
      if (setting.valueType === "int" && !Number.isInteger(n)) return fail("Enter a whole number");
      if (setting.valueType === "decimal" && Math.abs(Math.round(n * 100) - n * 100) > 1e-9) return fail("At most 2 decimal places");
      const err = rangeError(setting, n);
      return err ? fail(err) : ok(n);
    }
    case "money": {
      const text = String(raw).trim().replace(/,/g, "");
      if (text === "" || Number.isNaN(Number(text))) return fail("Enter an amount in taka");
      const taka = Number(text);
      if (taka < 0) return fail("Cannot be negative");
      if (Math.abs(Math.round(taka * 100) - taka * 100) > 1e-9) return fail("At most 2 decimal places (poisha)");
      const poisha = takaToPoisha(taka);
      const err = rangeError(setting, poisha, (p) => `৳${poishaToTaka(p)}`);
      return err ? fail(err) : ok(poisha);
    }
    case "enum":
      return (setting.options ?? []).includes(String(raw)) ? ok(String(raw)) : fail("Pick one of the options");
    case "time":
      return TIME_RE.test(String(raw)) ? ok(String(raw)) : fail("Use a time like 06:00");
    case "int_list": {
      const parts = String(raw).split(",").map((p) => p.trim()).filter(Boolean);
      if (!parts.length) return fail("Enter at least one number");
      const nums = parts.map(Number);
      if (nums.some((n) => !Number.isInteger(n) || n < 0)) return fail("Whole numbers separated by commas");
      if (new Set(nums).size !== nums.length) return fail("Each number only once");
      return ok(nums);
    }
    case "string_list": {
      const parts = String(raw).split(",").map((p) => p.trim()).filter(Boolean);
      if (!parts.length) return fail("Enter at least one key");
      if (parts.some((p) => !KEY_RE.test(p))) return fail("Lowercase keys like sports_gear, separated by commas");
      if (new Set(parts).size !== parts.length) return fail("Each key only once");
      return ok(parts);
    }
    case "json": {
      if (typeof raw !== "object" || raw === null) return fail("Fill in every field");
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw)) {
        const n = Number(String(v).trim());
        if (String(v).trim() === "" || Number.isNaN(n) || n < 0) return fail(`${k}: enter a number of 0 or more`);
        out[k] = n;
      }
      return ok(out);
    }
    default:
      return fail("This setting type cannot be edited here");
  }
}

/** Typed value → what the input shows. */
export function toInput(setting: Setting, value: SettingValue = setting.value): string | boolean | Record<string, string> {
  switch (setting.valueType) {
    case "bool":
      return Boolean(value);
    case "money":
      return poishaToTaka(Number(value));
    case "int_list":
    case "string_list":
      return Array.isArray(value) ? value.join(", ") : String(value);
    case "json":
      return Object.fromEntries(Object.entries((value ?? {}) as Record<string, number>).map(([k, v]) => [k, String(v)]));
    default:
      return String(value);
  }
}

/** Human display of a value, e.g. "5%", "৳80", "On", "60, 90, 120". */
export function display(setting: Pick<Setting, "valueType" | "unit">, value: SettingValue): string {
  switch (setting.valueType) {
    case "bool":
      return value ? "On" : "Off";
    case "money":
      return `৳${Number(poishaToTaka(Number(value))).toLocaleString("en-IN")}`;
    case "int_list":
    case "string_list":
      return Array.isArray(value) ? value.join(", ") : String(value);
    case "json":
      return Object.entries((value ?? {}) as Record<string, number>).map(([k, v]) => `${k} ${v}`).join(" · ");
    default: {
      const unit = setting.unit;
      if (!unit) return String(value);
      return unit === "%" ? `${value}%` : `${value} ${unit}`;
    }
  }
}

/** Order-independent equality, so an edit back to the original value is not a change. */
export function sameValue(a: unknown, b: unknown): boolean {
  const stable = (v: unknown): string => {
    if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
    if (v && typeof v === "object") return `{${Object.keys(v as object).sort().map((k) => `${k}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
    return JSON.stringify(v);
  };
  return stable(a) === stable(b);
}

/** The min–max hint under an input. */
export function rangeHint(setting: Setting): string | null {
  const fmt = (n: number) => (setting.valueType === "money" ? `৳${poishaToTaka(n)}` : `${n}`);
  if (setting.min != null && setting.max != null) return `${fmt(setting.min)}–${fmt(setting.max)}${setting.unit && setting.valueType !== "money" ? ` ${setting.unit}` : ""}`;
  return null;
}

/** "datetime-local" input value (browser local time) → ISO string, or undefined for "now". */
export function effectiveAtIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
