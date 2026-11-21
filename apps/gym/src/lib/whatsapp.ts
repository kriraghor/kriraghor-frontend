import { formatTaka } from "@kriraghor/ui/format";
import { whatsappChatUrl } from "@kriraghor/ui/share/links";

/**
 * WhatsApp chat buttons on the public gym page (M24-FR-158, step 1 of "WhatsApp for gyms", 21 Nov 2026):
 * the message each button prefills, in the page's language. Pure, so the words are tested without a
 * browser; the text comes from messages (gym.wa.msg) through `say`.
 */
export type WaSay = (key: "page" | "package" | "class", values: Record<string, string | number>) => string;

const BN = "০১২৩৪৫৬৭৮৯";
const digits = (text: string, locale: string) => (locale === "bn" ? text.replace(/\d/g, (d) => BN[Number(d)]) : text);
/** HH:MM in Dhaka (UTC+6, no daylight saving) for an ISO time. */
const dhakaClock = (iso: string) => new Date(new Date(iso).getTime() + 6 * 3_600_000).toISOString().slice(11, 16);

/** The public gym page's address, as the share button uses it. */
export const gymPageUrl = (site: string, slug: string) => `${site.replace(/\/+$/, "")}/gyms/${encodeURIComponent(slug)}`;

/** "Hi {gym}, I found you on Kriraghor: {url}" (the header button). */
export const gymMessage = (say: WaSay, x: { gym: string; url: string }) => say("page", { gym: x.gym, url: x.url });

/** A package card: the gym, the package, its price (Bangla digits in bn) and days, and the page. */
export const packageMessage = (say: WaSay, locale: string, x: { gym: string; title: string; pricePoisha: number; days: number; url: string }) =>
  say("package", { gym: x.gym, package: x.title, price: formatTaka(x.pricePoisha, locale), days: x.days, daysText: digits(String(x.days), locale), url: x.url });

/** A class in the timetable: the gym, the class, its day ("Saturday 22 Nov") and Dhaka start time. */
export function classMessage(say: WaSay, locale: string, x: { gym: string; name: string; date: string; startsAt: string }) {
  const day = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${x.date.slice(0, 10)}T12:00:00Z`));
  return say("class", { gym: x.gym, name: x.name, day, time: digits(dhakaClock(x.startsAt), locale) });
}

/** The chat link for a message, or null when the gym shows no number. */
export const chatHref = (number: string | null | undefined, text: string) => (number ? whatsappChatUrl(number, text) : null);

/** A member who agreed to an older consent text is asked to check and save again (gym_whatsapp.consent_version). */
export const needsRecheck = (x: { consentVersion: number | null; currentVersion: number }) => x.consentVersion != null && x.consentVersion < x.currentVersion;

/** A typed number for the API: trimmed, blank = null (the owner's number, or the member's phone). */
export const numberOrNull = (typed: string) => (typed.trim() ? typed.trim() : null);

/** Whether a 422 problem is about the `number` field. */
export const isNumberProblem = (p: { code?: string; errors?: { field: string }[] } | null | undefined) => p?.code === "VALIDATION_FAILED" && Boolean(p.errors?.some((e) => e.field === "number"));
