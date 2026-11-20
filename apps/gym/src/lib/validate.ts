import { bdMobile } from "@kriraghor/ui/kit";

/**
 * Form checks before anything is sent (tester feedback, 19 Nov 2026): each returns the fields that are
 * wrong as { field: messageKey }, with keys under gm.check in the messages. The server checks again.
 */
export type Problems = Record<string, string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LETTER = /\p{L}/u;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

const addYears = (ymd: string, years: number) => {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return `${String(y + years).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

/** The youngest and oldest birth dates a gym member may have: 5 to 100 years before today. */
export const birthRange = (today: string) => ({ min: addYears(today, -100), max: addYears(today, -5) });

export function nameProblem(v: string, { min = 2, max = 80 } = {}): string | null {
  const s = v.trim();
  if (!s) return "required";
  if (s.length < min || s.length > max || !LETTER.test(s)) return "name";
  return null;
}

export const emailProblem = (v: string) => (v.trim() && !EMAIL.test(v.trim()) ? "email" : null);
export const phoneProblem = (v: string, { required = true } = {}) => (!v.trim() ? (required ? "required" : null) : bdMobile.valid(v) ? null : "phone");

export function photoProblem(file: File | null): string | null {
  if (!file) return null;
  if (!PHOTO_TYPES.includes(file.type)) return "photoType";
  if (file.size > PHOTO_MAX_BYTES) return "photoSize";
  return null;
}

/** A taka amount as typed: digits with up to 2 decimals; `min` and `max` in taka. */
export function amountProblem(v: string, { required = true, min = 0, max = 10_000_000, allowZero = false } = {}): string | null {
  const s = v.trim().replace(/,/g, "");
  if (!s) return required ? "required" : null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return "amount";
  const n = Number(s);
  if ((!allowZero && n <= 0) || n < min || n > max) return "amountRange";
  return null;
}

export function wholeProblem(v: string, { required = false, min = 0, max = 100_000 } = {}): string | null {
  const s = v.trim();
  if (!s) return required ? "required" : null;
  if (!/^\d+$/.test(s)) return "whole";
  const n = Number(s);
  return n < min || n > max ? "range" : null;
}

type MemberDraft = { displayName: string; phone: string; birthDate: string; email: string; ecName: string; ecPhone: string };

/** Add a member: name and phone required; email, birth date and the emergency contact checked when given. */
export function memberProblems(d: MemberDraft, today: string, photo: File | null = null, { phoneRequired = true } = {}): Problems {
  const out: Problems = {};
  const put = (k: string, p: string | null) => {
    if (p) out[k] = p;
  };
  put("displayName", nameProblem(d.displayName));
  put("phone", phoneProblem(d.phone, { required: phoneRequired }));
  put("email", emailProblem(d.email));
  if (d.birthDate) {
    const r = birthRange(today);
    if (d.birthDate < r.min || d.birthDate > r.max) out.birthDate = "birthDate";
  }
  const ecName = d.ecName.trim();
  const ecPhone = d.ecPhone.trim();
  if (ecName || ecPhone) {
    if (!ecName) out.ecName = "ecBoth";
    else put("ecName", nameProblem(ecName));
    put("ecPhone", phoneProblem(ecPhone));
  }
  put("photo", photoProblem(photo));
  return out;
}
