import en from "../../messages/en.json";
import bn from "../../messages/bn.json";

/** The kit's own messages (kit, auth, account), merged under each app's messages in i18n/request.ts. */
export const sharedMessages = { en, bn } as const;

export function withSharedMessages<T extends Record<string, unknown>>(locale: string, app: T) {
  return { ...sharedMessages[locale === "bn" ? "bn" : "en"], ...app };
}
