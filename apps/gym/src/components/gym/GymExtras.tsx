"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle, WhatsappLogo } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { Button, Field, Notice, PhoneField, Select, Textarea } from "@kriraghor/ui/kit";
import { nameProblem, phoneProblem } from "@/lib/validate";
import { byDay, dhakaTime, gymOps2 } from "@/lib/gym-ops";
import { useFmt } from "@/components/gym-manage/common";
import { TrainerFace } from "@/components/TrainerFace";
import { chatHref, classMessage, type WaSay } from "@/lib/whatsapp";
import { bestTimeText, CALL_TIMES, nextTo, toMin } from "@/lib/call-time";

/**
 * The gym page's round 2 sections (M27-FR-66, FR-67): this week's classes with free places, and "Ask the gym"
 * (an enquiry the gym calls back about). Both come from one public read; a gym without classes shows no
 * timetable and a gym whose plan has no enquiries shows no form. With a chat number, each class has "Ask on
 * WhatsApp" (M24-FR-158).
 */
export function GymExtras({ slug, gymName, whatsapp = null }: { slug: string; gymName: string; whatsapp?: string | null }) {
  const q = useQuery({ queryKey: ["gym-timetable", slug], queryFn: () => gymOps2.timetable(slug), staleTime: 60_000, retry: false });
  if (!q.data) return null;
  return (
    <>
      {q.data.items.length ? <Timetable items={q.data.items} gymName={gymName} whatsapp={whatsapp} /> : null}
      {q.data.enquiries ? <Enquiry slug={slug} gymName={gymName} /> : null}
    </>
  );
}

function Timetable({ items, gymName, whatsapp }: { items: Awaited<ReturnType<typeof gymOps2.timetable>>["items"]; gymName: string; whatsapp: string | null }) {
  const t = useTranslations("go");
  const tw = useTranslations("gym.wa");
  const locale = useLocale();
  const f = useFmt();
  const say: WaSay = (key, values) => tw(`msg.${key}`, values);
  return (
    <>
      <h2 className="mt-8 text-2xl font-extrabold">{t("page.classes")}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2" data-testid="gym-timetable">
        {byDay(items).map((d) => (
          <div key={d.date} className="surface-card p-4">
            <p className="text-sm font-bold">{f.date(d.date)}</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {d.items.map((s) => {
                const ask = chatHref(whatsapp, classMessage(say, locale, { gym: gymName, name: s.name, date: d.date, startsAt: s.startsAt }));
                return (
                  <li key={s.id} className="flex flex-col">
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                        <span>
                          <span className="font-bold tabular-nums">{dhakaTime(s.startsAt)}</span> {s.name}
                        </span>
                        {s.trainer?.displayName ? (
                          <>
                            <span aria-hidden className="text-muted">·</span>
                            <TrainerFace name={s.trainer.displayName} src={s.trainer.avatarUrl} size={24} className="text-muted" />
                          </>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs text-muted">{s.spaces ? t("page.spaces", { n: f.n(s.spaces) }) : t("page.full")}</span>
                    </span>
                    {ask ? (
                      <a href={ask} target="_blank" rel="noopener noreferrer" aria-label={tw("askClass", { gym: gymName, name: s.name })} className="inline-flex min-h-11 items-center gap-1.5 self-start text-xs font-semibold text-brand-text underline-offset-4 hover:underline" data-testid="class-whatsapp">
                        <WhatsappLogo size={16} aria-hidden />
                        {tw("ask")}
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">{t("page.bookHint")}</p>
    </>
  );
}

function Enquiry({ slug, gymName }: { slug: string; gymName: string }) {
  const t = useTranslations("go");
  const [d, setD] = useState({ name: "", phone: "", message: "", bestFrom: "", bestTo: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    // 19 Nov 2026: a real name and an 11-digit 01 mobile before anything is sent.
    if (nameProblem(d.name) || phoneProblem(d.phone)) return setProblem(d.phone && phoneProblem(d.phone) ? t("page.phoneBad") : t("page.fill"));
    setBusy(true);
    setProblem(null);
    try {
      await gymOps2.enquire(slug, { name: d.name.trim(), phone: d.phone.trim(), message: d.message.trim() || null, bestTime: bestTimeText(d.bestFrom, d.bestTo), ...(d.website ? { website: d.website } : {}) });
      setDone(true);
    } catch (e2) {
      const code = problemOf(e2)?.code;
      setProblem(code === "RATE_LIMITED" ? t("page.tooMany") : code === "VALIDATION_FAILED" ? t("page.phoneBad") : t("page.failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h2 className="mt-8 text-2xl font-extrabold">{t("page.askTitle", { gym: gymName })}</h2>
      {done ? (
        <Notice tone="success" className="mt-3 max-w-xl" title={t("page.thanks")}>
          <span className="flex items-center gap-2" data-testid="enquiry-done">
            <CheckCircle size={18} aria-hidden /> {t("page.callBack")}
          </span>
        </Notice>
      ) : (
        <form onSubmit={send} className="mt-3 grid max-w-xl gap-3 sm:grid-cols-2" data-testid="enquiry-form">
          <Field id="eq-name" label={t("page.name")} value={d.name} maxLength={80} onChange={(e) => setD({ ...d, name: e.target.value })} autoComplete="name" />
          <PhoneField id="eq-phone" label={t("page.phone")} value={d.phone} onChange={(v) => setD({ ...d, phone: v })} placeholder="01XXXXXXXXX" required />
          <Textarea id="eq-msg" label={t("page.message")} optional={t("optional")} value={d.message} maxLength={500} onChange={(e) => setD({ ...d, message: e.target.value })} className="sm:col-span-2" />
          <BestTime from={d.bestFrom} to={d.bestTo} onChange={(bestFrom, bestTo) => setD({ ...d, bestFrom, bestTo })} />
          {/* A field people never see: robots fill it (M27-FR-66). Never carried over a language switch. */}
          <div aria-hidden data-no-carry className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="eq-website">Website</label>
            <input id="eq-website" tabIndex={-1} autoComplete="off" value={d.website} onChange={(e) => setD({ ...d, website: e.target.value })} />
          </div>
          {problem ? (
            <p role="alert" className="text-sm text-danger sm:col-span-2">
              {problem}
            </p>
          ) : null}
          <Button type="submit" busy={busy} className="sm:col-span-2 sm:justify-self-start" data-testid="enquiry-send">
            {t("page.send")}
          </Button>
          <p className="text-xs text-muted sm:col-span-2">{t("page.privacy")}</p>
        </form>
      )}
    </>
  );
}

/**
 * "Best time to call" (tester feedback, 28 Nov 2026): two time pickers, From and To, every half hour, with
 * "Any time" first. Sent as "18:00–20:00".
 */
function BestTime({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const t = useTranslations("go");
  const locale = useLocale();
  const label = (hhmm: string) =>
    new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 1, toMin(hhmm) / 60, toMin(hhmm) % 60)));
  return (
    <fieldset className="grid grid-cols-2 gap-3 sm:col-span-2" data-testid="enquiry-best-time">
      <legend className="mb-1.5 text-sm font-semibold">
        {t("page.bestTime")} <span className="font-normal text-muted">({t("optional")})</span>
      </legend>
      <Select id="eq-best-from" label={t("page.bestFrom")} value={from} onChange={(e) => onChange(e.target.value, nextTo(e.target.value, to))}>
        <option value="">{t("page.anyTime")}</option>
        {CALL_TIMES.slice(0, -1).map((x) => (
          <option key={x} value={x}>
            {label(x)}
          </option>
        ))}
      </Select>
      <Select id="eq-best-to" label={t("page.bestTo")} value={to} disabled={!from} onChange={(e) => onChange(from, e.target.value)}>
        {!from ? <option value="">{t("page.anyTime")}</option> : null}
        {CALL_TIMES.filter((x) => from && toMin(x) > toMin(from)).map((x) => (
          <option key={x} value={x}>
            {label(x)}
          </option>
        ))}
      </Select>
    </fieldset>
  );
}
