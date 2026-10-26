"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus, Trash } from "@phosphor-icons/react";
import { Button, Card, Field, IconButton, Notice, Select, Skeleton, useToast } from "@kriraghor/ui/kit";
import { gymDesk, type OwnerGym } from "@/lib/manage";
import { KINDS, packageRowsOf, packagesPayload, type Channel, type PackageKind, type PackageRow } from "@/lib/gym-manage";
import { GymPage, useGymError, usePackages, type GymCtx } from "./common";

/**
 * /manage/[gymId]/packages (owner; M24-FR-24, M20 extended): every active package. Kind (day, month,
 * 3, 6 or 12 months, custom days), title, price, admission fee, channel (desk: the gym's own books;
 * online: passes; both), visit limit and order. Saving replaces the active set; a package left out is
 * retired (running memberships keep their snapshot). A day pass sold online is needed only to list.
 */
export function Packages({ gymId }: { gymId: string }) {
  const t = useTranslations("gm");
  return (
    <GymPage gymId={gymId} page="packages" title={t("packages.title")} description={t("packages.lead")} testId="gm-packages">
      {(ctx) => <Editor ctx={ctx} />}
    </GymPage>
  );
}

const blankRow = (kind: PackageKind, title: string, channel: Channel): PackageRow => ({ kind, title, taka: "", days: kind === "custom" ? "30" : "", admissionTaka: "", channel, visitLimit: "", on: true });

function Editor({ ctx }: { ctx: GymCtx }) {
  const err = useGymError();
  const { q } = usePackages(ctx.gymId, true);
  if (q.isPending) return <Skeleton className="h-64 rounded-card" />;
  if (q.isError || !q.data) return <Notice tone="error">{err(q.error)}</Notice>;
  return <Rows ctx={ctx} g={q.data} />;
}

function Rows({ ctx, g }: { ctx: GymCtx; g: OwnerGym }) {
  const t = useTranslations("gm");
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const [rows, setRows] = useState<PackageRow[]>(() => packageRowsOf(g.packages));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ text: string; row: number } | null>(null);
  const listed = g.status !== "draft";
  const defaultChannel: Channel = listed ? "both" : "desk";
  const kindDays = g.limits.kindDays as Record<string, number>;
  const used = new Set(rows.filter((r) => r.kind !== "custom").map((r) => r.kind));
  const nextKind = (["month", "quarter", "half_year", "year", "day"] as PackageKind[]).find((k) => !used.has(k)) ?? "custom";
  const update = (i: number, patch: Partial<PackageRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...rows];
    const [r] = next.splice(i, 1);
    next.splice(i + d, 0, r);
    setRows(next);
  };
  const save = async () => {
    setProblem(null);
    const body = packagesPayload(rows, g.limits.maxCustomPackages);
    if (!body.ok) return setProblem({ text: t(`packages.problem.${body.problem}`, { max: g.limits.maxCustomPackages }), row: body.row });
    setBusy(true);
    try {
      const saved = await gymDesk.setPackages(ctx.gymId, body.packages);
      qc.setQueryData(["vendor-gym", ctx.gymId], saved);
      setRows(packageRowsOf(saved.packages));
      toast.show(t("packages.saved"));
    } catch (e) {
      setProblem({ text: err(e), row: -1 });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      {!listed ? <Notice tone="info">{t("packages.privateNote")}</Notice> : null}
      {!rows.length ? <p className="text-sm text-muted">{t("packages.none")}</p> : null}
      <ul className="flex flex-col gap-2" data-testid="packages-rows">
        {rows.map((r, i) => (
          <li key={i}>
            <Card padded={false} className={problem?.row === i ? "border-danger p-3" : "p-3"} data-testid="package-row">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Select id={`pk-kind-${i}`} label={t("packages.kind")} value={r.kind} onChange={(e) => update(i, { kind: e.target.value as PackageKind, days: e.target.value === "custom" ? r.days || "30" : "" })}>
                  {KINDS.map((k) => (
                    <option key={k} value={k} disabled={k !== "custom" && k !== r.kind && used.has(k)}>
                      {t(`kind.${k}`)}
                    </option>
                  ))}
                </Select>
                <Field id={`pk-title-${i}`} label={t("packages.titleLabel")} value={r.title} maxLength={80} onChange={(e) => update(i, { title: e.target.value })} data-testid={`pk-title-${i}`} />
                <Field id={`pk-price-${i}`} label={t("packages.price")} inputMode="decimal" value={r.taka} onChange={(e) => update(i, { taka: e.target.value })} leading={<span className="text-muted">৳</span>} data-testid={`pk-price-${i}`} />
                {r.kind === "custom" ? (
                  <Field id={`pk-days-${i}`} label={t("packages.days")} inputMode="numeric" value={r.days} onChange={(e) => update(i, { days: e.target.value })} hint={t("packages.daysHint")} />
                ) : (
                  <Field id={`pk-days-${i}`} label={t("packages.days")} value={String(kindDays[r.kind] ?? "")} readOnly disabled />
                )}
                <Field id={`pk-adm-${i}`} label={t("packages.admission")} optional={t("optional")} inputMode="decimal" value={r.admissionTaka} onChange={(e) => update(i, { admissionTaka: e.target.value })} leading={<span className="text-muted">৳</span>} />
                <Select id={`pk-ch-${i}`} label={t("packages.channel")} value={r.channel} onChange={(e) => update(i, { channel: e.target.value as Channel })}>
                  {(["desk", "online", "both"] as const).map((c) => (
                    <option key={c} value={c}>
                      {t(`channel.${c}`)}
                    </option>
                  ))}
                </Select>
                <Field id={`pk-visits-${i}`} label={t("packages.visitLimit")} optional={t("optional")} inputMode="numeric" value={r.visitLimit} onChange={(e) => update(i, { visitLimit: e.target.value })} />
                <div className="flex items-end gap-1">
                  <IconButton label={t("packages.up")} variant="secondary" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={16} aria-hidden />
                  </IconButton>
                  <IconButton label={t("packages.down")} variant="secondary" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown size={16} aria-hidden />
                  </IconButton>
                  <Button type="button" variant="ghost" icon={<Trash size={16} aria-hidden />} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                    {t("packages.retire")}
                  </Button>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {problem ? <Notice tone="error">{problem.text}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" icon={<Plus size={16} aria-hidden />} onClick={() => setRows([...rows, blankRow(nextKind, t(`kindTitle.${nextKind}`), nextKind === "day" ? "online" : defaultChannel)])} data-testid="package-add">
          {t("packages.add")}
        </Button>
        <Button type="button" onClick={save} busy={busy} data-testid="packages-save">
          {t("packages.save")}
        </Button>
      </div>
    </div>
  );
}
