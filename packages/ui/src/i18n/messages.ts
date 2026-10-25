import en from "../../messages/en.json";
import bn from "../../messages/bn.json";

/**
 * The kit's own messages (kit, auth, account, and the parts of trust and team the shared reviews and
 * desk helpers use), merged under each app's messages in i18n/request.ts.
 */
export const sharedMessages = { en, bn } as const;

type Tree = Record<string, unknown>;
const isTree = (v: unknown): v is Tree => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * The app's messages over the shared ones. A namespace both define (for example "trust" or "team")
 * is merged one level deep, so the app keeps its own keys and gains the shared ones; the app's value
 * wins wherever both have the same key.
 */
export function withSharedMessages<T extends Record<string, unknown>>(locale: string, app: T) {
  const shared: Tree = sharedMessages[locale === "bn" ? "bn" : "en"];
  const out: Tree = { ...shared };
  for (const [ns, value] of Object.entries(app)) out[ns] = isTree(value) && isTree(shared[ns]) ? { ...shared[ns], ...value } : value;
  return out as (typeof sharedMessages)["en"] & T;
}
