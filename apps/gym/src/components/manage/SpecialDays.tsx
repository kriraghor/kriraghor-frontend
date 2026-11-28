"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash } from "@phosphor-icons/react";
import { Badge, Button, Card, Dialog, Field, IconButton, Notice, SegmentedControl, SkeletonList } from "@kriraghor/ui/kit";
import { DatePicker, TimePicker, addDaysYmd, dhakaToday, formatDateLabel, localDigits } from "@kriraghor/ui/date";
import { problemOf } from "@kriraghor/api-client";
import { gymDesk, isOneDay, specialDayBody, specialDayProblem, type SpecialDay, type SpecialDayInput } from "@/lib/manage";

type Affected = { visits: number };

/**
 * Holidays and special hours (M20-FR-16 to FR-21), under the weekly hours on the gym page editor. The owner
 * adds a range of dates as closed (Eid, a repair) or with its own hours (Ramadan timings). It applies at
 * once, without review: the gym page shows it, trial-visit slots follow it, and class sessions and booked
 * visits it leaves shut are cancelled (the people are told). So the form first shows what would be
 * cancelled, then saves. Removing one brings its class sessions back empty.
 */
export function SpecialDays({ gymId }: { gymId: string }) {
  const t = useTranslations("vendorGym.special");
  const locale = useLocale();
  const qc = useQueryClient();
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const q = useQuery({ queryKey: ["gym-special-days", gymId, scope], queryFn: () => gymDesk.specialDays(gymId, scope) });
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<SpecialDay | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["gym-special-days", gymId] });

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setProblem(null);
    try {
      await gymDesk.removeSpecialDay(gymId, removing.id);
      setRemoving(null);
      await refresh();
    } catch (err) {
      setProblem(problemOf(err)?.title ?? t("failed"));
    } finally {
      setBusy(false);
    }
  };

  const items = q.data?.items ?? [];
  return (
    <Card id="gym-special-days" className="scroll-mt-24" data-testid="gym-special-days">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold">{t("title")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t("help")}</p>
        </div>
        <Button variant="secondary" icon={<Plus size={18} aria-hidden />} onClick={() => setAdding(true)} data-testid="special-day-add">
          {t("add")}
        </Button>
      </div>
      <SegmentedControl
        className="mt-4"
        size="sm"
        label={t("show")}
        value={scope}
        onChange={setScope}
        options={[
          { value: "upcoming", label: t("upcoming") },
          { value: "past", label: t("past") },
        ]}
      />
      {q.isLoading ? <SkeletonList rows={2} /> : null}
      {q.error ? <Notice tone="error">{t("failed")}</Notice> : null}
      {q.data && !items.length ? <p className="mt-4 text-sm text-muted">{scope === "upcoming" ? t("none") : t("nonePast")}</p> : null}
      {items.length ? (
        <ul className="mt-3 flex flex-col divide-y divide-line" data-testid="special-day-list">
          {items.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{d.title}</p>
                <p className="text-sm text-muted">
                  <RangeText d={d} locale={locale} />
                  {d.kind === "hours" ? (
                    <span className="tabular-nums">
                      {" · "}
                      {d.windows.map((w) => localDigits(`${w.openTime}–${w.closeTime}`, locale)).join(", ")}
                    </span>
                  ) : null}
                </p>
              </div>
              <Badge tone={d.status === "removed" ? "neutral" : d.kind === "closed" ? "danger" : "warning"}>{d.status === "removed" ? t("removed") : t(`kind.${d.kind}`)}</Badge>
              {d.status === "active" && d.phase !== "past" ? (
                <IconButton label={t("remove")} className="text-danger" onClick={() => (setProblem(null), setRemoving(d))}>
                  <Trash size={18} aria-hidden />
                </IconButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog open={adding} onOpenChange={setAdding} title={t("addTitle")}>
        {adding && q.data ? <AddForm gymId={gymId} maxDays={q.data.limits.maxDays} aheadDays={q.data.limits.aheadDays} onDone={() => (setAdding(false), setScope("upcoming"), void refresh())} /> : null}
      </Dialog>

      <Dialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("removeTitle")}
        description={t("removeBody")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              {t("keep")}
            </Button>
            <Button variant="danger" busy={busy} onClick={() => void remove()} data-testid="special-day-remove">
              {t("remove")}
            </Button>
          </>
        }
      >
        {removing ? (
          <p className="text-sm">
            <span className="font-bold">{removing.title}</span>
            {" · "}
            <RangeText d={removing} locale={locale} />
          </p>
        ) : null}
        {problem ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {problem}
          </p>
        ) : null}
      </Dialog>
    </Card>
  );
}

function RangeText({ d, locale }: { d: { fromOn: string; toOn: string }; locale: string }) {
  return <span>{isOneDay(d) ? formatDateLabel(d.fromOn, locale) : `${formatDateLabel(d.fromOn, locale)} – ${formatDateLabel(d.toOn, locale)}`}</span>;
}

/** The form: dates, closed or changed hours, a title; "Check" shows what it would cancel, then "Save". */
function AddForm({ gymId, maxDays, aheadDays, onDone }: { gymId: string; maxDays: number; aheadDays: number; onDone: () => void }) {
  const t = useTranslations("vendorGym.special");
  const locale = useLocale();
  const today = dhakaToday();
  const [d, setD] = useState<SpecialDayInput>({ fromOn: today, toOn: today, kind: "closed", windows: [{ openTime: "10:00", closeTime: "16:00", womenOnly: false }], title: "" });
  const [affected, setAffected] = useState<Affected | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Any change needs a new check: the counts shown must be for what will be saved.
  const patch = (x: Partial<SpecialDayInput>) => (setD({ ...d, ...x }), setAffected(null), setProblem(null));
  const setWindow = (i: number, x: Partial<SpecialDayInput["windows"][number]>) => patch({ windows: d.windows.map((w, j) => (j === i ? { ...w, ...x } : w)) });
  const bad = specialDayProblem(d, { today, maxDays });

  const send = async (save: boolean) => {
    if (bad) return setProblem(t(`problem.${bad}`, { n: maxDays }));
    setBusy(true);
    setProblem(null);
    try {
      if (!save) setAffected((await gymDesk.previewSpecialDay(gymId, specialDayBody(d))).affected);
      else {
        await gymDesk.addSpecialDay(gymId, specialDayBody(d));
        onDone();
      }
    } catch (err) {
      const p = problemOf(err);
      setProblem(p?.code && t.has(`error.${p.code}`) ? t(`error.${p.code}`) : (p?.title ?? t("failed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      data-testid="special-day-form"
      onSubmit={(e) => {
        e.preventDefault();
        void send(Boolean(affected));
      }}
    >
      <Field id="sd-title" label={t("name")} hint={t("nameHint")} value={d.title} maxLength={80} onChange={(e) => patch({ title: e.target.value })} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <DatePicker id="sd-from" label={t("from")} value={d.fromOn} min={today} max={addDaysYmd(today, aheadDays)} clearable={false} onChange={(v) => v && patch({ fromOn: v, toOn: d.toOn < v ? v : d.toOn })} />
        <DatePicker id="sd-to" label={t("to")} value={d.toOn} min={d.fromOn} max={addDaysYmd(d.fromOn, maxDays - 1)} clearable={false} onChange={(v) => v && patch({ toOn: v })} />
      </div>
      <SegmentedControl
        label={t("what")}
        value={d.kind}
        onChange={(kind) => patch({ kind })}
        options={[
          { value: "closed", label: t("kind.closed"), testId: "sd-closed" },
          { value: "hours", label: t("kind.hours"), testId: "sd-hours" },
        ]}
      />
      {d.kind === "hours" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">{t("hoursOn")}</legend>
          {d.windows.map((w, i) => (
            <div key={i} className="flex min-w-0 flex-wrap items-center gap-2">
              <TimePicker id={`sd-open-${i}`} label={t("opens")} labelHidden step={30} required value={w.openTime} onChange={(v) => setWindow(i, { openTime: v })} className="w-36" />
              <span aria-hidden>-</span>
              <TimePicker id={`sd-close-${i}`} label={t("closes")} labelHidden step={30} endOfDay required value={w.closeTime} onChange={(v) => setWindow(i, { closeTime: v })} className="w-40" />
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={w.womenOnly} onChange={(e) => setWindow(i, { womenOnly: e.target.checked })} />
                {t("womenOnly")}
              </label>
              {d.windows.length > 1 ? (
                <IconButton label={t("removeWindow")} className="text-danger" onClick={() => patch({ windows: d.windows.filter((_, j) => j !== i) })}>
                  <Trash size={18} aria-hidden />
                </IconButton>
              ) : null}
            </div>
          ))}
          {d.windows.length < 4 ? (
            <Button type="button" size="sm" variant="secondary" className="self-start" onClick={() => patch({ windows: [...d.windows, { openTime: d.windows.at(-1)?.closeTime ?? "10:00", closeTime: "22:00", womenOnly: false }] })}>
              {t("addWindow")}
            </Button>
          ) : null}
        </fieldset>
      ) : null}

      {affected ? (
        <Notice tone={affected.visits > 0 ? "warning" : "info"} title={t("checkTitle")}>
          <span data-testid="special-day-affected">
            {affected.visits > 0
              ? t("willCancel", { visits: localDigits(String(affected.visits), locale) })
              : t("cancelsNothing")}
          </span>
        </Notice>
      ) : (
        <p className="text-sm text-muted">{t("applies")}</p>
      )}
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
      <Button
        type="submit"
        busy={busy}
        variant={affected ? "primary" : "secondary"}
        confirm={
          affected && !bad
            ? {
                kind: "add",
                title: t("saveAsk"),
                body:
                  affected.visits > 0
                    ? t("willCancel", { visits: localDigits(String(affected.visits), locale) })
                    : t("cancelsNothing"),
              }
            : undefined
        }
        data-testid={affected ? "special-day-save" : "special-day-check"}
      >
        {affected ? t("save") : t("check")}
      </Button>
    </form>
  );
}
