"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Barbell, Plus, QrCode, UsersThree, ChartBar, Warning } from "@phosphor-icons/react";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { Badge, Button, ButtonLink, Card, EmptyState, Notice, Skeleton } from "@kriraghor/ui/kit";
import { DeskAccessNotice, Field, deskAccessKey, inputCls } from "@kriraghor/ui/desk";
import { gymDesk } from "@/lib/manage";
import { canOpen } from "@/lib/manage-nav";
import type { ManageGym } from "@/lib/gym-manage";
import { useFmt, useGymError, useManageGyms } from "@/components/gym-manage/common";

/**
 * /manage (M24 §4.1): my gyms with today's numbers (check-ins, active members), each gym's plan and
 * setup state, and "Add a gym". Staff see the gyms they work at with the desks their permissions open.
 * A gym whose short code is not set yet asks for it first (members and receipts need it).
 */
export function GymsDesk() {
  const t = useTranslations("gm");
  const err = useGymError();
  const [adding, setAdding] = useState(false);
  const q = useManageGyms();
  const access = deskAccessKey(problemOf(q.error)?.code);
  const items = q.data?.items ?? [];
  const owner = q.data?.owner ?? null;

  return (
    <section className="mx-auto w-full max-w-[1100px] px-4 py-5 sm:px-6 md:py-8" data-testid="manage-gyms">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold md:text-3xl">{t("gyms.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t("gyms.lead")}</p>
        </div>
        <Button type="button" icon={<Plus size={18} aria-hidden />} onClick={() => setAdding(true)} data-testid="add-gym">
          {t("gyms.add")}
        </Button>
      </div>
      {adding ? <AddGym onClose={() => setAdding(false)} /> : null}
      {owner ? (
        <Card padded={false} className="mt-4 flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4" data-testid="owner-plan">
          <p className="text-sm">
            {t("gyms.plan")} <Badge tone="brand">{t(`tier.${owner.tier}`)}</Badge>{" "}
            {owner.restricted ? <Badge tone="danger">{t("gyms.restricted")}</Badge> : null}
          </p>
          <ButtonLink href="/manage/billing" variant="secondary" size="sm">
            {t("gyms.billing")}
          </ButtonLink>
        </Card>
      ) : null}
      <div className="mt-4">
        {q.isPending ? (
          <Skeleton className="h-48 rounded-card" />
        ) : access ? (
          <div className="flex flex-col gap-3">
            <DeskAccessNotice error={q.error} />
            <Link href="/start" className="font-semibold text-brand-text underline">
              {t("gyms.toStart")}
            </Link>
          </div>
        ) : q.isError ? (
          <Notice tone="error">{err(q.error)}</Notice>
        ) : !items.length ? (
          <EmptyState icon={<Barbell size={32} aria-hidden />} title={t("gyms.empty")} body={t("gyms.emptyBody")} action={<ButtonLink href="/start">{t("gyms.toStart")}</ButtonLink>} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2" data-testid="my-gyms">
            {items.map((g) => (
              <li key={g.id}>
                <GymCard g={g} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function GymCard({ g }: { g: ManageGym }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const perms = g.role === "owner" ? null : (g.permissions ?? []);
  return (
    <Card padded={false} className="flex h-full flex-col gap-3 p-4" data-testid="gym-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/manage/${g.id}`} className="block truncate font-display text-lg font-bold hover:text-brand-text">
            {g.name}
          </Link>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone={g.role === "owner" ? "brand" : "info"}>{t(`role.${g.role}`)}</Badge>
            <Badge>{g.listingStatus === "draft" ? t("gyms.private") : t("gyms.listed")}</Badge>
            <Badge>{t(`tier.${g.tier}`)}</Badge>
            {g.shortCode ? <Badge>{g.shortCode}</Badge> : null}
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-control bg-surface-2 p-2">
          <dt className="text-xs text-muted">{t("gyms.checkInsToday")}</dt>
          <dd className="font-display text-xl font-extrabold tabular-nums">{f.n(g.today.checkIns)}</dd>
        </div>
        <div className="rounded-control bg-surface-2 p-2">
          <dt className="text-xs text-muted">{t("gyms.activeMembers")}</dt>
          <dd className="font-display text-xl font-extrabold tabular-nums">{f.n(g.today.activeMembers)}</dd>
        </div>
      </dl>
      {!g.setupDone ? (
        g.role === "owner" ? (
          <Notice tone="warning" title={t("gyms.setupTitle")} action={<ButtonLink href={`/start?gym=${g.id}&step=code`} size="sm" data-testid="gym-setup">{t("gyms.setupCta")}</ButtonLink>}>
            {t("gyms.setupBody")}
          </Notice>
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Warning size={16} aria-hidden /> {t("gyms.setupStaff")}
          </p>
        )
      ) : null}
      <div className="mt-auto flex flex-wrap gap-2">
        <ButtonLink href={`/manage/${g.id}`} size="sm" icon={<ChartBar size={16} aria-hidden />}>
          {t("nav.dashboard")}
        </ButtonLink>
        {canOpen("desk", perms) ? (
          <ButtonLink href={`/manage/${g.id}/desk`} size="sm" variant="secondary" icon={<QrCode size={16} aria-hidden />} data-testid="open-desk">
            {t("nav.desk")}
          </ButtonLink>
        ) : null}
        {canOpen("members", perms) ? (
          <ButtonLink href={`/manage/${g.id}/members`} size="sm" variant="secondary" icon={<UsersThree size={16} aria-hidden />}>
            {t("nav.members")}
          </ButtonLink>
        ) : null}
        {g.role === "owner" ? (
          <ButtonLink href={`/manage/${g.id}/settings#gm-remove`} size="sm" variant="ghost" className="ml-auto text-danger" data-testid="gym-remove-link">
            {t("remove.open")}
          </ButtonLink>
        ) : null}
      </div>
    </Card>
  );
}

/** "Add a gym": name, area and address (a private gym), then the short code and packages on /start. */
function AddGym({ onClose }: { onClose: () => void }) {
  const tv = useTranslations("vendorGym");
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
      await qc.invalidateQueries({ queryKey: ["manage-gyms"] });
      await qc.invalidateQueries({ queryKey: ["vendor-gyms"] });
      router.push(`/start?gym=${g.id}&step=code`);
    } catch (err) {
      setProblem(problemOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="surface-card mt-4 grid gap-3 border-brand p-4 md:grid-cols-2" data-testid="add-gym-form">
      <h2 className="font-display text-lg font-bold md:col-span-2">{tv("add")}</h2>
      <Field label={tv("form.name")}>
        <input value={f.name} onChange={(e) => set("name", e.target.value)} minLength={3} maxLength={120} required className={inputCls} />
      </Field>
      <Field label={tv("form.area")}>
        <select value={f.areaId} onChange={(e) => set("areaId", e.target.value)} required className={inputCls}>
          <option value="">{tv("form.chooseArea")}</option>
          {(areas.data?.items ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.nameEn}
            </option>
          ))}
        </select>
      </Field>
      <div className="md:col-span-2">
        <Field label={tv("form.address")}>
          <input value={f.addressLine} onChange={(e) => set("addressLine", e.target.value)} minLength={5} maxLength={300} required className={inputCls} />
        </Field>
      </div>
      {problem ? (
        <div className="md:col-span-2">
          <Notice tone="error">{problem.errors?.map((e) => e.message).join(" · ") || problem.title}</Notice>
        </div>
      ) : null}
      <div className="flex gap-2 md:col-span-2">
        <Button type="submit" busy={busy} confirm="add">
          {tv("form.create")}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          {tv("cancel")}
        </Button>
      </div>
    </form>
  );
}
