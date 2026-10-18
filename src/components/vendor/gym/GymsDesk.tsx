"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { problemOf, type Problem } from "@/lib/api/client";
import { formatTaka } from "@/lib/admin/finance";
import { gymDesk } from "@/lib/vendor/gym";
import { Notice } from "../../ui";
import { Chip, Field, inputCls } from "../../admin/finance/shared";
import { STATUS_TONE } from "../GroundsDesk";

/** /vendor/gyms (M20): my gyms with their review state and day price, and "Add a gym" (the first draft). */
export function GymsDesk() {
  const t = useTranslations("vendorGym");
  const locale = useLocale();
  const [adding, setAdding] = useState(false);
  const q = useQuery({ queryKey: ["vendor-gyms"], queryFn: () => gymDesk.mine(), retry: false });
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
  const items = q.data?.items ?? [];
  return (
    <section className="mx-auto max-w-[1100px] px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-muted">{t("lead")}</p>
        </div>
        <button type="button" className="min-h-12 bg-brand px-5 font-bold text-white hover:bg-brand-hover" onClick={() => setAdding(true)} data-testid="add-gym">
          {t("add")}
        </button>
      </div>
      {adding ? <AddGym onClose={() => setAdding(false)} /> : null}
      {q.isPending ? <div className="mt-6 h-48 animate-pulse bg-surface-2" /> : null}
      {q.data && !items.length ? <p className="mt-8 border-2 border-dashed border-line p-8 text-center text-muted">{t("empty")}</p> : null}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2" data-testid="my-gyms">
        {items.map((g) => {
          const day = g.packages.find((p) => p.kind === "day");
          return (
            <li key={g.id} className="flex h-full flex-col gap-3 border-2 border-line bg-surface p-3">
              <Link href={`/vendor/gyms/${g.id}`} className="flex gap-4 hover:text-brand">
                {g.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.photos[0].url} alt="" className="h-24 w-32 shrink-0 object-cover" />
                ) : (
                  <span className="grid h-24 w-32 shrink-0 place-items-center bg-surface-2 text-xs text-muted">{t("noPhoto")}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-extrabold">{g.name}</span>
                  <span className="mt-1 flex flex-wrap gap-2">
                    <Chip tone={STATUS_TONE[g.status] ?? "muted"}>{t(`status.${g.status}`)}</Chip>
                    {g.editStatus ? <Chip tone={g.editStatus === "changes_requested" ? "bad" : "warn"}>{t(`edit.${g.editStatus}`)}</Chip> : null}
                  </span>
                  <span className="mt-2 block text-sm text-muted">{day ? t("dayFrom", { price: formatTaka(day.price, locale) }) : t("noPackages")}</span>
                </span>
              </Link>
              {g.status === "live" || g.status === "paused" ? (
                <div className="flex flex-wrap gap-2">
                  <Link href={`/vendor/gyms/${g.id}/desk`} className="inline-flex min-h-11 items-center bg-brand px-4 text-sm font-bold text-white" data-testid="open-desk">
                    {t("desk.open")}
                  </Link>
                  <Link href={`/vendor/gyms/${g.id}/passes`} className="inline-flex min-h-11 items-center border-2 border-line px-4 text-sm font-bold">
                    {t("sold.open")}
                  </Link>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "Add a gym": name, area and address (photos, hours and packages follow in the editor). */
function AddGym({ onClose }: { onClose: () => void }) {
  const t = useTranslations("vendorGym");
  const router = useRouter();
  const qc = useQueryClient();
  const areas = useQuery({ queryKey: ["gym-areas"], queryFn: () => gymDesk.areas() });
  const [f, setF] = useState({ name: "", areaId: "", addressLine: "" });
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    setBusy(true);
    try {
      const g = await gymDesk.create({ name: f.name, areaId: f.areaId, addressLine: f.addressLine });
      await qc.invalidateQueries({ queryKey: ["vendor-gyms"] });
      router.push(`/vendor/gyms/${g.id}`);
    } catch (err) {
      setProblem(problemOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-4 border-2 border-brand bg-surface p-5 md:grid-cols-2" data-testid="add-gym-form">
      <h2 className="text-xl font-extrabold md:col-span-2">{t("add")}</h2>
      <Field label={t("form.name")}>
        <input value={f.name} onChange={(e) => set("name", e.target.value)} minLength={3} maxLength={120} required className={inputCls} />
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
          <input value={f.addressLine} onChange={(e) => set("addressLine", e.target.value)} minLength={5} maxLength={300} required className={inputCls} />
        </Field>
      </div>
      {problem ? (
        <div className="md:col-span-2">
          <Notice tone="error">{problem.errors?.map((e) => e.message).join(" · ") || problem.title}</Notice>
        </div>
      ) : null}
      <div className="flex gap-2 md:col-span-2">
        <button type="submit" disabled={busy} className="min-h-12 bg-brand px-5 font-bold text-white disabled:opacity-50">
          {t("form.create")}
        </button>
        <button type="button" className="min-h-12 border-2 border-line px-5 font-bold" onClick={onClose}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
