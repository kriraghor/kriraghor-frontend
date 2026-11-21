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

// ---------------------------------------------------------------- step 2: sending (M24-FR-166 to FR-170)

/** The words of the approved templates, from messages (gw.preview): `stop` is the STOP line every bulk message ends with. */
export type PreviewSay = (key: "notice" | "greeting" | "stop", values?: Record<string, string>) => string;

/**
 * The message bubble a member sees: notice = "{gym}: {title}\n\n{message}\n\n{STOP line}", greeting =
 * "{gym}: {message}\n\n{STOP line}". Empty parts show as "…" so the shape is visible while typing.
 */
export function previewText(say: PreviewSay, x: { kind: "notice" | "greeting"; gym: string; title?: string; message: string }) {
  const dots = (s: string | undefined) => (s && s.trim() ? s.trim() : "…");
  const stop = say("stop");
  return x.kind === "notice" ? say("notice", { gym: x.gym, title: dots(x.title), message: dots(x.message), stop }) : say("greeting", { gym: x.gym, message: dots(x.message), stop });
}

/** Why a bulk send cannot go yet, first reason first; null when it can. */
export type SendBlock = "off" | "no_sender" | "addon" | "nobody" | "cap" | "balance";
export function sendBlock(x: { apiEnabled: boolean; est: { reachable: number; unitsNeeded: number; balance: number; bulkLeft: number; senderConnected: boolean; addonActive: boolean } | null }): SendBlock | null {
  if (!x.apiEnabled) return "off";
  const e = x.est;
  if (!e) return null;
  if (!e.senderConnected) return "no_sender";
  if (!e.addonActive) return "addon";
  if (e.reachable <= 0) return "nobody";
  if (e.bulkLeft <= 0) return "cap";
  if (e.unitsNeeded > e.balance) return "balance";
  return null;
}

/** Members a send does not reach, by why (only the reasons with someone in them). */
export function notReached(e: { no_consent: number; template: number; no_sender: number }): { key: "no_consent" | "template" | "no_sender"; n: number }[] {
  return (["no_consent", "template", "no_sender"] as const).map((key) => ({ key, n: e[key] })).filter((x) => x.n > 0);
}

const BLOCK_REASONS = ["off", "tier", "restricted", "addon", "balance", "no_consent", "nobody", "template", "no_sender"];

/** The friendly-text key (under gw.err) for a WhatsApp problem, or null for problems the app's own helper explains. */
export function waProblemKey(p: { code?: string; meta?: Record<string, unknown> } | null | undefined): string | null {
  switch (p?.code) {
    case "GYM_WHATSAPP_BLOCKED": {
      const reason = typeof p.meta?.reason === "string" ? p.meta.reason : "";
      return BLOCK_REASONS.includes(reason) ? `blocked.${reason}` : "blocked.other";
    }
    case "GYM_WHATSAPP_NO_SENDER":
      return "blocked.no_sender";
    case "GYM_WHATSAPP_API_OFF":
      return "blocked.off";
    case "GYM_WHATSAPP_CAP":
      return "cap";
    case "GYM_WHATSAPP_UNAVAILABLE":
      return "unavailable";
    case "GYM_WHATSAPP_OFF":
      return "addonOff";
    case "GYM_WHATSAPP_NUMBER_TAKEN":
      return "numberTaken";
    case "GYM_WHATSAPP_META_FAILED":
      return "metaFailed";
    case "GYM_WHATSAPP_RECEIPT":
      return "receipt";
    default:
      return null;
  }
}

/** A send's delivery counts: delivered includes read (read comes after delivered); waiting = queued or sent. */
export const sendCounts = (s: { delivered: number; read: number; failed: number; queued: number; sent: number }) => ({ delivered: s.delivered + s.read, read: s.read, failed: s.failed, waiting: s.queued + s.sent });

/** What the billing card shows: coming soon (the platform switch), the plan lacks it, off, or on. */
export function unitsCardState(u: { enabled: boolean; available: boolean; status: "active" | "paused" | "ended" | null }): "soon" | "plan" | "off" | "on" {
  if (!u.enabled) return "soon";
  if (!u.available) return "plan";
  return u.status === "active" ? "on" : "off";
}
