"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { newKey } from "@/lib/bookings";
import { dhakaDay, dhakaInstant, hire, type Engagement, type Format, type ProfilePage, type Unit } from "@/lib/hire";
import { formatTaka } from "@/lib/payments";
import { Button, Notice } from "@kriraghor/ui/primitives";
import { DatePicker, TimePicker } from "@kriraghor/ui/date";

type Row = { date: string; time: string; format: Format | ""; hours: string; venueText: string; venueAreaId: string };
const MAX_ROWS = 10;

/** A day picked on the profile's availability grid; `n` changes on every pick, so picking the same day again still applies. */
export type DatePick = { date: string; n: number };

/** A first engagement: four days out at 19:30 Dhaka (outside the short-notice window), the role's first format. */
const blankRow = (profile: ProfilePage): Row => ({ date: dhakaDay(new Date(Date.now() + 4 * 86400000)), time: "19:30", format: profile.role.formatPriced ? (profile.role.formats[0] as Format) : "", hours: "2", venueText: "", venueAreaId: "" });

/**
 * The request form on a profile page (M11 FR-20, FR-21): how they are hired, 1 to 10 matches or
 * sessions (date and time on the Dhaka clock, format or hours, the venue and its area), a note, and
 * the server's quote per engagement (base, night, short notice, travel zone, rounded to ৳50). Sending
 * needs a verified phone (gate hire); the money is asked for only once the person accepts.
 * A day picked on the availability grid (`pick`) becomes the date of the match or session last
 * touched; days the pro is unavailable all day are greyed in the date picker.
 */
export function RequestForm({ profile, pick, unavailableDays, onDateChange }: { profile: ProfilePage; pick?: DatePick | null; unavailableDays?: string[]; onDateChange?: (date: string) => void }) {
  const t = useTranslations("hire");
  const locale = useLocale();
  const router = useRouter();
  const { status } = useAuth();
  const units = profile.role.allowedUnits as Unit[];
  const [unit, setUnit] = useState<Unit>(units[0] ?? "match");
  const [rows, setRows] = useState<Row[]>(() => [blankRow(profile)]);
  const [today] = useState(() => dhakaDay(new Date()));
  const [note, setNote] = useState("");
  const [key] = useState(newKey);
  // The row whose date a grid pick sets: the one last focused, else the first.
  const [active, setActive] = useState(0);
  const [seenPick, setSeenPick] = useState(pick);
  if (pick !== seenPick) {
    setSeenPick(pick);
    if (pick) setRows((rs) => rs.map((r, j) => (j === Math.min(active, rs.length - 1) ? { ...r, date: pick.date } : r)));
  }
  useEffect(() => {
    if (!pick) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`hire-date-${active}`)?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    // Only a new pick scrolls; focusing another row must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick]);
  const areas = useQuery({ queryKey: ["hire-areas"], queryFn: () => hire.areas(), staleTime: 300_000 });
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const money = (n: number) => formatTaka(n, locale);

  const engagements: Engagement[] = rows.map((r) => ({
    start: r.date && r.time ? dhakaInstant(r.date, r.time) : "",
    ...(unit === "match" && r.format ? { format: r.format } : {}),
    ...(unit === "hourly" ? { hours: Number(r.hours) } : {}),
    venueText: r.venueText.trim(),
    venueAreaId: r.venueAreaId,
  }));
  const ready = engagements.every((e) => e.start && e.venueAreaId && e.venueText.length >= 3 && (unit === "match" || (e.hours ?? 0) >= 1));
  const quote = useQuery({ queryKey: ["hire-quote", profile.id, unit, engagements], queryFn: () => hire.quote(profile.id, unit, engagements), enabled: ready, retry: false });
  const send = useMutation({
    mutationFn: () => hire.send(profile.id, unit, engagements, note, key),
    onSuccess: (r) => router.push(`/me/hire/${r.request.code}`),
  });
  const problem = send.error ? problemOf(send.error) : quote.error ? problemOf(quote.error) : null;
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const lineLabel = (k: string) => (t.has(`line.${k}`) ? t(`line.${k}`) : k);

  if (status !== "signed_in")
    return (
      <div>
        <h2 className="text-xl font-extrabold">{t("hireTitle", { name: profile.name })}</h2>
        <p className="mt-2 text-sm text-muted">{t("signInToHire")}</p>
        <Link href={`/sign-in?next=/hiring/${profile.slug}`} className="mt-3 inline-flex min-h-12 items-center bg-brand px-5 font-bold text-on-brand hover:bg-brand-hover">
          {t("signIn")}
        </Link>
      </div>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) send.mutate();
      }}
      className="flex flex-col gap-4"
      data-testid="hire-request-form"
    >
      <h2 className="text-xl font-extrabold">{t("hireTitle", { name: profile.name })}</h2>
      {units.length > 1 ? (
        <fieldset>
          <legend className="text-sm font-bold">{t("hiredBy")}</legend>
          <div className="mt-2 flex gap-2">
            {units.map((u) => (
              <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)} className={`rounded-control min-h-11 border px-4 font-bold ${unit === u ? "border-brand bg-brand/10" : "border-line"}`}>
                {t(`unit.${u}`)}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      <ol className="flex flex-col gap-4">
        {rows.map((r, i) => (
          <li key={i} className="rounded-card border border-line p-3" data-testid="hire-engagement" onFocusCapture={() => setActive(i)}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">{unit === "match" ? t("matchN", { n: i + 1 }) : t("sessionN", { n: i + 1 })}</span>
              {rows.length > 1 ? (
                <button type="button" className="min-h-10 px-2 text-sm font-semibold text-danger underline" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  {t("remove")}
                </button>
              ) : null}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <DatePicker
                id={`hire-date-${i}`}
                className="col-span-2"
                label={t("date")}
                value={r.date}
                min={today}
                disabledDays={unavailableDays}
                required
                clearable={false}
                onChange={(v) => {
                  set(i, { date: v });
                  setActive(i);
                  onDateChange?.(v);
                }}
                testId="hire-date"
              />
              <TimePicker id={`hire-time-${i}`} label={t("time")} value={r.time} step={15} required onChange={(v) => set(i, { time: v })} testId="hire-time" />
              {unit === "match" && profile.role.formatPriced ? (
                <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
                  {t("format")}
                  <select value={r.format} onChange={(e) => set(i, { format: e.target.value as Format })} className="min-h-12 field px-2 text-base text-ink">
                    {profile.role.formats.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {unit === "hourly" ? (
                <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
                  {t("hours")}
                  <input type="number" min={1} max={12} step={0.5} value={r.hours} onChange={(e) => set(i, { hours: e.target.value })} required className="min-h-12 field px-2 text-base text-ink" />
                </label>
              ) : null}
              <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
                {t("venueArea")}
                <select value={r.venueAreaId} onChange={(e) => set(i, { venueAreaId: e.target.value })} required className="min-h-12 field px-2 text-base text-ink" data-testid="hire-venue-area">
                  <option value="">{t("choose")}</option>
                  {(areas.data?.items ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {name(a)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-2 flex flex-col gap-1 text-sm font-semibold text-muted">
              {t("venue")}
              <input value={r.venueText} onChange={(e) => set(i, { venueText: e.target.value })} minLength={3} maxLength={200} required placeholder={t("venueHint")} className="min-h-12 field px-3 text-base text-ink" data-testid="hire-venue" />
            </label>
            {quote.data?.lines[i] ? (
              <p className="mt-2 text-sm" data-testid="hire-line-quote">
                {quote.data.lines[i].lines.map((l) => `${lineLabel(l.key)} ${money(l.amount)}`).join(" + ")} = <strong className="tabular-nums">{money(quote.data.lines[i].total)}</strong>
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      {rows.length < MAX_ROWS ? (
        <button type="button" className="rounded-control min-h-11 self-start border border-line-strong/60 px-4 text-sm font-bold hover:border-brand" onClick={() => setRows([...rows, { ...rows[rows.length - 1], date: dhakaDay(new Date(new Date(`${rows[rows.length - 1].date}T12:00:00Z`).getTime() + 7 * 86400000)) }])}>
          {unit === "match" ? t("addMatch") : t("addSession")}
        </button>
      ) : null}
      <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
        {t("note")}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder={t("noteHint")} className="surface-card p-3 text-base text-ink" />
      </label>
      <div className="flex items-baseline justify-between border-t-2 border-line pt-3">
        <span className="font-semibold">{t("total")}</span>
        <span className="text-2xl font-extrabold tabular-nums" data-testid="hire-quote-total">
          {quote.data ? money(quote.data.total) : "–"}
        </span>
      </div>
      <p className="text-sm text-muted">{t("payLater")}</p>
      {problem ? (
        <Notice tone="error">
          {problem.code === "DUPLICATE_REQUEST" ? t("duplicate") : problem.code === "OWN_PROFILE" ? t("ownProfile") : problem.title}{" "}
          {problem.status === 403 ? (
            <Link href="/account/verification" className="font-bold underline">
              {t("verifyPhone")}
            </Link>
          ) : null}
        </Notice>
      ) : null}
      <Button type="submit" busy={send.isPending} disabled={!ready || !quote.data} data-testid="hire-send">
        {t("send")}
      </Button>
    </form>
  );
}
