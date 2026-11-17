"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CheckCircle } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { Button, Field, Notice, Textarea } from "@kriraghor/ui/kit";
import { byDay, dhakaTime, gymOps2 } from "@/lib/gym-ops";
import { useFmt } from "@/components/gym-manage/common";

/**
 * The gym page's round 2 sections (M27-FR-66, FR-67): this week's classes with free places, and "Ask the gym"
 * (an enquiry the gym calls back about). Both come from one public read; a gym without classes shows no
 * timetable and a gym whose plan has no enquiries shows no form.
 */
export function GymExtras({ slug, gymName }: { slug: string; gymName: string }) {
  const q = useQuery({ queryKey: ["gym-timetable", slug], queryFn: () => gymOps2.timetable(slug), staleTime: 60_000, retry: false });
  if (!q.data) return null;
  return (
    <>
      {q.data.items.length ? <Timetable items={q.data.items} /> : null}
      {q.data.enquiries ? <Enquiry slug={slug} gymName={gymName} /> : null}
    </>
  );
}

function Timetable({ items }: { items: Awaited<ReturnType<typeof gymOps2.timetable>>["items"] }) {
  const t = useTranslations("go");
  const f = useFmt();
  return (
    <>
      <h2 className="mt-8 text-2xl font-extrabold">{t("page.classes")}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2" data-testid="gym-timetable">
        {byDay(items).map((d) => (
          <div key={d.date} className="surface-card p-4">
            <p className="text-sm font-bold">{f.date(d.date)}</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {d.items.map((s) => (
                <li key={s.id} className="flex items-baseline justify-between gap-2">
                  <span>
                    <span className="font-bold tabular-nums">{dhakaTime(s.startsAt)}</span> {s.name}
                    {s.trainer?.displayName ? <span className="text-muted"> · {s.trainer.displayName}</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{s.spaces ? t("page.spaces", { n: f.n(s.spaces) }) : t("page.full")}</span>
                </li>
              ))}
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
  const [d, setD] = useState({ name: "", phone: "", message: "", bestTime: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.name.trim() || d.phone.replace(/\D/g, "").length < 10) return setProblem(t("page.fill"));
    setBusy(true);
    setProblem(null);
    try {
      await gymOps2.enquire(slug, { name: d.name.trim(), phone: d.phone.trim(), message: d.message.trim() || null, bestTime: d.bestTime.trim() || null, ...(d.website ? { website: d.website } : {}) });
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
          <Field id="eq-phone" label={t("page.phone")} type="tel" inputMode="tel" value={d.phone} maxLength={20} onChange={(e) => setD({ ...d, phone: e.target.value })} autoComplete="tel" placeholder="01XXXXXXXXX" />
          <Textarea id="eq-msg" label={t("page.message")} optional={t("optional")} value={d.message} maxLength={500} onChange={(e) => setD({ ...d, message: e.target.value })} className="sm:col-span-2" />
          <Field id="eq-best" label={t("page.bestTime")} optional={t("optional")} value={d.bestTime} maxLength={40} onChange={(e) => setD({ ...d, bestTime: e.target.value })} placeholder={t("page.bestTimeHint")} />
          {/* A field people never see: robots fill it (M27-FR-66). */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
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
