"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash } from "@phosphor-icons/react";
import { Button, Card, Dialog, Field, IconButton, Notice, Select } from "@kriraghor/ui/kit";
import { DatePicker, addDaysYmd, dhakaToday } from "@kriraghor/ui/date";
import { newKey } from "@kriraghor/ui/format";
import { BODY_FIELDS, BODY_UNIT, bodyValues, chartPoints, chartRange, emptyDraft, fieldsWithData, seriesOf, type BodyDraft, type BodyEntry, type BodyField, type BodyInput, type BodyProgress } from "@/lib/gym-progress";
import { useFmt } from "@/components/gym-manage/common";

/**
 * Body progress (M24 §20, FR-128 to FR-133), the same view for the member (My membership) and for the
 * owner and plan writers (the member's profile): the change since the first entry, one measurement over
 * time as a line, the entries, and "Add a measurement". Numbers and a chart only; no photos.
 * `onAdd` and `onRemove` do the saving; `canRemove` says which entries this viewer may remove.
 */
export function BodyProgressView({
  data,
  onAdd,
  onRemove,
  canRemove,
  forStaff = false,
  testId = "progress",
}: {
  data: BodyProgress;
  onAdd: (body: BodyInput, key: string) => Promise<unknown>;
  onRemove: (entryId: string) => Promise<unknown>;
  canRemove: (e: BodyEntry) => boolean;
  /** The gym's view on a member's profile: the texts speak about the member, not to them. */
  forStaff?: boolean;
  testId?: string;
}) {
  const t = useTranslations("gm.body");
  const f = useFmt();
  const have = fieldsWithData(data.entries);
  const [picked, setPicked] = useState<BodyField>("weightKg");
  const field = have.includes(picked) ? picked : (have[0] ?? "weightKg");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<BodyEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const unit = (k: BodyField, n: number) => t(`unit.${BODY_UNIT[k]}`, { n: f.n(n) });
  const change = data.change[field];
  const newestFirst = [...data.entries].reverse();

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setProblem(null);
    try {
      await onRemove(removing.id);
      setRemoving(null);
    } catch {
      setProblem(t("failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padded={false} className="flex flex-col gap-3 p-4" data-testid={testId}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold">{t("title")}</h2>
          <p className="text-sm text-muted">{t(forStaff ? "leadStaff" : "lead")}</p>
        </div>
        <Button type="button" size="sm" variant="secondary" icon={<Plus size={16} aria-hidden />} onClick={() => setAdding(true)} data-testid="progress-add">
          {t("add")}
        </Button>
      </div>

      {!data.entries.length ? (
        <p className="text-sm text-muted" data-testid="progress-empty">
          {t(forStaff ? "emptyStaff" : "empty")}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            {have.length > 1 ? (
              <Select id={`${testId}-field`} label={t("show")} value={field} onChange={(e) => setPicked(e.target.value as BodyField)} className="w-full sm:w-56" data-testid="progress-field">
                {have.map((k) => (
                  <option key={k} value={k}>
                    {t(`field.${k}`)}
                  </option>
                ))}
              </Select>
            ) : null}
          <p className="text-sm sm:text-right" data-testid="progress-change">
            {change ? (
              <>
                <span className="font-bold tabular-nums">{t(change.delta > 0 ? "up" : change.delta < 0 ? "down" : "same", { amount: unit(field, Math.abs(change.delta)) })}</span>{" "}
                <span className="text-muted">{t("since", { date: f.date(change.fromOn), from: unit(field, change.from), to: unit(field, change.to) })}</span>
              </>
            ) : (
              <span className="text-muted">{t("oneEntry")}</span>
            )}
          </p>
          </div>
          <BodyChart title={t(`field.${field}`)} series={seriesOf(data.entries, field)} valueText={(n) => unit(field, n)} dateText={f.date} shortDate={f.short} />
          {/* Each entry: the date and who recorded it on one line, then one small tile per measurement. */}
          <ul className="flex flex-col gap-2" data-testid="progress-entries">
            {newestFirst.map((e) => (
              <li key={e.id} className="rounded-control border border-line p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">{f.date(e.measuredOn)}</span>
                  {e.byRole === "staff" ? <span className="text-xs text-muted">· {t("byGym")}</span> : null}
                  {canRemove(e) ? (
                    <IconButton label={t("remove")} className="-my-2 ml-auto text-danger" onClick={() => (setProblem(null), setRemoving(e))}>
                      <Trash size={18} aria-hidden />
                    </IconButton>
                  ) : null}
                </div>
                <dl className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-1.5">
                  {BODY_FIELDS.filter((k) => e[k] != null).map((k) => (
                    <div key={k} className={`rounded-[8px] px-2 py-1.5 ${k === field ? "bg-brand/10" : "bg-surface-2"}`}>
                      <dt className="text-[11px] text-muted">{t(`short.${k}`)}</dt>
                      <dd className="font-semibold tabular-nums">{unit(k, e[k] as number)}</dd>
                    </div>
                  ))}
                  {e.bmi != null ? (
                    <div className="rounded-[8px] bg-surface-2 px-2 py-1.5">
                      <dt className="text-[11px] text-muted">BMI</dt>
                      <dd className="font-semibold tabular-nums">{f.n(e.bmi)}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog open={adding} onOpenChange={setAdding} title={t("addTitle")}>
        {adding ? <AddForm data={data} onAdd={onAdd} onDone={() => setAdding(false)} /> : null}
      </Dialog>
      <Dialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("removeTitle")}
        description={removing ? t("removeBody", { date: f.date(removing.measuredOn) }) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              {t("keep")}
            </Button>
            <Button variant="danger" busy={busy} onClick={() => void remove()} data-testid="progress-remove">
              {t("remove")}
            </Button>
          </>
        }
      >
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
      </Dialog>
    </Card>
  );
}

/** The form: a date (today by default) and the seven measurements, any of them left empty. */
function AddForm({ data, onAdd, onDone }: { data: BodyProgress; onAdd: (body: BodyInput, key: string) => Promise<unknown>; onDone: () => void }) {
  const t = useTranslations("gm.body");
  const f = useFmt();
  const today = dhakaToday();
  const [date, setDate] = useState(today);
  const [d, setD] = useState<BodyDraft>(emptyDraft);
  const [key] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // A field's range is shown once Save was tried, not while the first digit is being typed.
  const [tried, setTried] = useState(false);
  const limits = data.limits.fields;
  const checked = bodyValues(d, limits);
  const replaces = data.entries.some((e) => e.measuredOn === date);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (checked.empty) return setProblem(t("needOne"));
    if (checked.bad.length) return setProblem(t("bad", { field: t(`field.${checked.bad[0]!}`), min: f.n(limits[checked.bad[0]!].min), max: f.n(limits[checked.bad[0]!].max) }));
    setBusy(true);
    setProblem(null);
    try {
      await onAdd({ measuredOn: date, ...checked.values }, key);
      onDone();
    } catch {
      setProblem(t("failed"));
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={save} data-testid="progress-form">
      <DatePicker id="body-date" label={t("date")} value={date} min={addDaysYmd(today, -data.limits.backdateDays)} max={today} clearable={false} onChange={(v) => v && setDate(v)} />
      {replaces ? <Notice tone="info">{t("replaces")}</Notice> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {BODY_FIELDS.map((k) => (
          <Field
            key={k}
            id={`body-${k}`}
            label={t(`label.${k}`)}
            inputMode="decimal"
            autoComplete="off"
            value={d[k]}
            error={tried && checked.bad.includes(k) ? t("range", { min: f.n(limits[k].min), max: f.n(limits[k].max) }) : undefined}
            onChange={(e) => (setProblem(null), setD({ ...d, [k]: e.target.value }))}
          />
        ))}
      </div>
      <p className="text-xs text-muted">{t("hint")}</p>
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
      <Button type="submit" busy={busy} confirm="add" data-testid="progress-save">
        {t("save")}
      </Button>
    </form>
  );
}

const PAD = 28;
type ChartText = { valueText: (n: number) => string; dateText: (d: string) => string; shortDate: (d: string) => string };

/**
 * One measurement over time as a single line (so no legend: the title names it). Points sit by date. The
 * vertical range hugs the values and both ends are printed, so a small change is visible and not mistaken
 * for a drop to zero. The latest value is labelled; every point answers hover, focus and touch with its
 * date and value; the entries list under the chart is the table view. Phones get their own plot size, so
 * the line and the points keep their weight instead of shrinking with the page.
 */
function BodyChart({ title, series, ...text }: { title: string; series: { date: string; value: number }[] } & ChartText) {
  const [on, setOn] = useState<number | null>(null);
  if (series.length < 2) return null;
  const last = series.length - 1;
  return (
    <figure className="min-w-0" data-testid="progress-chart">
      <figcaption className="sr-only">{title}</figcaption>
      <Plot title={title} series={series} w={340} h={190} shown={on ?? last} onShow={setOn} className="sm:hidden" {...text} />
      <Plot title={title} series={series} w={600} h={200} shown={on ?? last} onShow={setOn} className="hidden sm:block" {...text} />
      <div className="mt-1 flex justify-between text-xs tabular-nums text-muted" aria-hidden>
        <span>{text.shortDate(series[0]!.date)}</span>
        <span>{text.shortDate(series[last]!.date)}</span>
      </div>
    </figure>
  );
}

function Plot({ title, series, w, h, shown, onShow, className, valueText, dateText, shortDate }: { title: string; series: { date: string; value: number }[]; w: number; h: number; shown: number; onShow: (i: number | null) => void; className: string } & ChartText) {
  const pts = chartPoints(series, { w, h, pad: PAD });
  const range = chartRange(series.map((p) => p.value));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <div className={`relative ${className}`}>
      <svg viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full" role="img" aria-label={title}>
        {[PAD, h - PAD].map((y) => (
          <line key={y} x1={PAD} x2={w - PAD} y1={y} y2={y} stroke="var(--color-line)" strokeWidth="1" />
        ))}
        <path d={path} fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={series[i]!.date}>
            <circle cx={p.x} cy={p.y} r={i === shown ? 6 : 4} fill="var(--color-brand)" stroke="var(--color-surface)" strokeWidth="2" />
            <circle
              cx={p.x}
              cy={p.y}
              r={18}
              fill="transparent"
              tabIndex={0}
              role="img"
              aria-label={`${dateText(series[i]!.date)}: ${valueText(series[i]!.value)}`}
              className="cursor-pointer outline-none focus-visible:stroke-[var(--color-brand)] focus-visible:[stroke-width:2]"
              onMouseEnter={() => onShow(i)}
              onMouseLeave={() => onShow(null)}
              onFocus={() => onShow(i)}
              onBlur={() => onShow(null)}
              onClick={() => onShow(i)}
            />
          </g>
        ))}
      </svg>
      <span className="pointer-events-none absolute left-0 top-0 text-xs tabular-nums text-muted" aria-hidden>
        {valueText(range.max)}
      </span>
      <span className="pointer-events-none absolute bottom-0 left-0 text-xs tabular-nums text-muted" aria-hidden>
        {valueText(range.min)}
      </span>
      <span
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-control border border-line bg-surface px-2 py-1 text-xs shadow-sm"
        style={{ left: `${Math.min(84, Math.max(16, (pts[shown]!.x / w) * 100))}%`, top: `${(pts[shown]!.y / h) * 100 - 6}%` }}
        data-testid="progress-chart-tip"
        aria-hidden
      >
        <span className="font-bold tabular-nums">{valueText(series[shown]!.value)}</span> <span className="text-muted">{shortDate(series[shown]!.date)}</span>
      </span>
    </div>
  );
}
