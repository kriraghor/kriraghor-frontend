"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { formatTaka } from "@/lib/admin/finance";
import { toPoisha, vendor } from "@/lib/vendor/grounds";
import { Notice } from "@kriraghor/ui/primitives";
import { Chip, Field, inputCls } from "../admin/finance/shared";

// A listing's review state as a desk colour, shared with the gym editor on gym.kriraghor.com.
import { STATUS_TONE } from "@kriraghor/ui/desk/access";
export { STATUS_TONE };
const TABS = ["all", "live", "pending_review", "changes_requested", "draft", "paused", "rejected"] as const;

/** /vendor/grounds (M09 §4.4): my grounds by status, and "Add a venue" (the first draft). */
export function GroundsDesk() {
  const t = useTranslations("vendorGrounds");
  const locale = useLocale();
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const [adding, setAdding] = useState(false);
  const q = useQuery({ queryKey: ["vendor-grounds"], queryFn: () => vendor.mine(), retry: false });
  const problem = problemOf(q.error);
  if (problem?.code === "ROLE_REQUIRED" || problem?.code === "KYC_REQUIRED") {
    return (
      <section className="mx-auto max-w-3xl px-5 py-10">
        <Notice tone="error">{t("gate")}</Notice>
        <Link href="/vendor" className="mt-4 inline-block font-semibold text-brand underline">
          {t("gateLink")}
        </Link>
      </section>
    );
  }
  const items = (q.data?.items ?? []).filter((g) => tab === "all" || g.status === tab || (tab === "changes_requested" && g.editStatus === "changes_requested"));
  return (
    <section className="mx-auto max-w-[1100px] px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-muted">{t("lead")}</p>
        </div>
        <button type="button" className="min-h-12 bg-brand px-5 font-bold text-white hover:bg-brand-hover" onClick={() => setAdding(true)} data-testid="add-ground">
          {t("add")}
        </button>
      </div>
      {adding ? <AddGround onClose={() => setAdding(false)} /> : null}
      <div role="tablist" aria-label={t("title")} className="mt-6 flex flex-wrap gap-2">
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-control min-h-11 border px-3 text-sm font-bold ${tab === k ? "border-brand text-ink" : "border-line text-muted"}`}>
            {t(`tab.${k}`)}
          </button>
        ))}
      </div>
      {q.isPending ? <div className="rounded-card mt-6 h-48 kg-shimmer bg-surface-2" /> : null}
      {q.data && !items.length ? <p className="rounded-card mt-8 border border-dashed border-line p-8 text-center text-muted">{t("empty")}</p> : null}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2" data-testid="my-grounds">
        {items.map((g) => (
          <li key={g.id}>
            <Link href={`/vendor/venues/${g.id}`} className="rounded-card flex h-full gap-4 border border-line bg-surface p-3 hover:border-brand">
              {g.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.coverUrl} alt="" className="h-24 w-32 shrink-0 object-cover" />
              ) : (
                <span className="grid h-24 w-32 shrink-0 place-items-center bg-surface-2 text-xs text-muted">{t("noPhoto")}</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-extrabold">{g.name}</span>
                <span className="mt-1 flex flex-wrap gap-2">
                  <Chip tone={STATUS_TONE[g.status] ?? "muted"}>{t(`status.${g.status}`)}</Chip>
                  {g.editStatus ? <Chip tone={g.editStatus === "changes_requested" ? "bad" : "warn"}>{t(`edit.${g.editStatus}`)}</Chip> : null}
                </span>
                <span className="mt-2 block text-sm text-muted">
                  {t("courts", { n: g.courtsCount })} · {g.basePricePoisha ? t("perHour", { price: formatTaka(g.basePricePoisha, locale) }) : "–"}
                </span>
                {g.reviewReason ? <span className="mt-1 block text-sm text-danger">{t(`reason.${g.reviewReason.code}`)}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Add a venue": name, area, address, map pin and the base price (seeds the first pricing version). */
function AddGround({ onClose }: { onClose: () => void }) {
  const t = useTranslations("vendorGrounds");
  const router = useRouter();
  const qc = useQueryClient();
  const areas = useQuery({ queryKey: ["catalog-areas"], queryFn: () => vendor.areas() });
  const [f, setF] = useState({ name: "", areaId: "", addressLine: "", lat: "", lng: "", price: "2400", isIndoor: false });
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const area = areas.data?.items.find((a) => a.id === f.areaId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    const base = toPoisha(f.price);
    if (base === null) return setProblem({ code: "VALIDATION_FAILED", title: t("form.badPrice"), status: 422 });
    setBusy(true);
    try {
      const g = await vendor.create({
        name: f.name,
        areaId: f.areaId,
        addressLine: f.addressLine,
        lat: Number(f.lat || area?.lat),
        lng: Number(f.lng || area?.lng),
        isIndoor: f.isIndoor,
        basePricePoisha: base,
      });
      await qc.invalidateQueries({ queryKey: ["vendor-grounds"] });
      router.push(`/vendor/venues/${g.id}`);
    } catch (err) {
      setProblem(problemOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-card mt-6 grid gap-4 border border-brand bg-surface p-5 md:grid-cols-2" data-testid="add-ground-form">
      <h2 className="text-xl font-extrabold md:col-span-2">{t("add")}</h2>
      <Field label={t("form.name")}>
        <input value={f.name} onChange={(e) => set("name", e.target.value)} minLength={3} maxLength={80} required className={inputCls} />
      </Field>
      <Field label={t("form.area")}>
        <select value={f.areaId} onChange={(e) => set("areaId", e.target.value)} required className={inputCls}>
          <option value="">{t("form.chooseArea")}</option>
          {(areas.data?.items ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.nameEn}
            </option>
          ))}
        </select>
      </Field>
      <div className="md:col-span-2">
        <Field label={t("form.address")}>
          <input value={f.addressLine} onChange={(e) => set("addressLine", e.target.value)} minLength={5} maxLength={200} required className={inputCls} />
        </Field>
      </div>
      <Field label={t("form.lat")}>
        <input value={f.lat} onChange={(e) => set("lat", e.target.value)} placeholder={area ? String(area.lat) : "23.7465"} inputMode="decimal" className={inputCls} />
      </Field>
      <Field label={t("form.lng")}>
        <input value={f.lng} onChange={(e) => set("lng", e.target.value)} placeholder={area ? String(area.lng) : "90.3760"} inputMode="decimal" className={inputCls} />
      </Field>
      <Field label={t("form.basePrice")}>
        <input value={f.price} onChange={(e) => set("price", e.target.value)} inputMode="decimal" required className={inputCls} />
      </Field>
      <label className="flex min-h-11 items-center gap-2 self-end">
        <input type="checkbox" className="h-5 w-5" checked={f.isIndoor} onChange={(e) => set("isIndoor", e.target.checked)} />
        {t("form.indoor")}
      </label>
      <p className="text-xs text-muted md:col-span-2">{t("form.pinHelp")}</p>
      {problem ? (
        <div className="md:col-span-2">
          <Notice tone="error">{problem.errors?.map((e) => e.message).join(" · ") || problem.title}</Notice>
        </div>
      ) : null}
      <div className="flex gap-2 md:col-span-2">
        <button type="submit" disabled={busy} className="min-h-12 bg-brand px-5 font-bold text-white disabled:opacity-50">
          {t("form.create")}
        </button>
        <button type="button" className="rounded-control min-h-12 border border-line-strong/60 px-5 font-bold" onClick={onClose}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
