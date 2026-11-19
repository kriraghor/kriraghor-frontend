"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Barbell, ClockCounterClockwise, PencilSimple, Plus, Wrench } from "@phosphor-icons/react";
import { Badge, Button, Card, Checkbox, Dialog, EmptyState, Field, IconButton, Notice, SegmentedControl, Select, SkeletonList, Textarea, useToast } from "@kriraghor/ui/kit";
import { newKey } from "@kriraghor/ui/format";
import { cn } from "@kriraghor/ui/cn";
import { dhakaToday } from "@/lib/gym-manage";
import { ASSET_CATEGORIES, gymStaff, PAY_METHODS, type Asset, type AssetCategory, type AssetInput, type AssetStatus, type PayMethod } from "@/lib/gym-staff";
import { GymPage, useFmt, useGymError, type GymCtx } from "../gym-manage/common";

/**
 * /manage/[gymId]/equipment (M27-FR-82 to FR-86; assets.manage, reads also reports.view; Standard plan): the
 * machines with their status and next service; add or change one; open a machine for its history and log a
 * service, a repair or a note (a cost can go into the expenses); retire a machine (final).
 */
export function Equipment({ gymId }: { gymId: string }) {
  const t = useTranslations("gt");
  return (
    <GymPage
      gymId={gymId}
      page="equipment"
      feature="equipment"
      wide
      title={t("eq.title")}
      description={t("eq.lead")}
      actions={(ctx) => (ctx.can("assets.manage") ? <AddButton ctx={ctx} /> : null)}
      testId="gt-equipment"
    >
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

const TONE: Record<AssetStatus, "brand" | "warning" | "danger" | "neutral"> = { working: "brand", needs_service: "warning", out_of_order: "danger", retired: "neutral" };

function AddButton({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gt");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} data-testid="asset-add">
        <Plus size={18} aria-hidden />
        {t("eq.add")}
      </Button>
      {open ? <AssetDialog ctx={ctx} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

type Filter = "in_use" | "retired";

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gt");
  const f = useFmt();
  const err = useGymError();
  const [filter, setFilter] = useState<Filter>("in_use");
  const [open, setOpen] = useState<Asset | null>(null);
  const [editing, setEditing] = useState<Asset | null>(null);
  const q = useQuery({ queryKey: ["gt-assets", ctx.gymId, filter], queryFn: () => gymStaff.assets(ctx.gymId, filter === "retired" ? "retired" : undefined) });
  const c = q.data?.counts;
  return (
    <div className="flex flex-col gap-4">
      {c ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="asset-counts">
          {(["working", "needs_service", "out_of_order"] as const).map((s) => (
            <Card key={s} className="p-3">
              <p className="text-xs text-muted">{t(`eq.status.${s}`)}</p>
              <p className="font-display text-2xl font-extrabold tabular-nums">{f.n(c[s])}</p>
            </Card>
          ))}
          <Card className={cn("p-3", c.serviceDue && "border-warning/50")}>
            <p className="text-xs text-muted">{t("eq.serviceDue")}</p>
            <p className={cn("font-display text-2xl font-extrabold tabular-nums", c.serviceDue && "text-warning")}>{f.n(c.serviceDue)}</p>
          </Card>
        </div>
      ) : null}
      <SegmentedControl
        label={t("eq.title")}
        value={filter}
        onChange={setFilter}
        className="self-start"
        options={[
          { value: "in_use", label: t("eq.inUse") },
          { value: "retired", label: t("eq.status.retired") },
        ]}
      />
      {q.isPending ? (
        <SkeletonList rows={4} />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : !q.data.items.length ? (
        <EmptyState icon={<Barbell size={28} aria-hidden />} title={filter === "retired" ? t("eq.noneRetired") : t("eq.none")} body={filter === "retired" ? undefined : t("eq.noneHint")} />
      ) : (
        <ul className="grid gap-2 md:grid-cols-2" data-testid="asset-list">
          {q.data.items.map((a) => (
            <li key={a.id}>
              <Card className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => setOpen(a)} className="min-w-0 text-left">
                    <span className="block font-semibold hover:underline">{a.name}</span>
                    <span className="block text-xs text-muted">{[t(`eq.cat.${a.category}`), a.brand, a.serial, a.location].filter(Boolean).join(" · ")}</span>
                  </button>
                  <Badge tone={TONE[a.status]}>{t(`eq.status.${a.status}`)}</Badge>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className={cn(a.serviceDue ? "font-semibold text-warning" : "text-muted")}>
                    {a.nextServiceOn ? (a.serviceDue ? t("eq.dueSince", { date: f.date(a.nextServiceOn) }) : t("eq.nextService", { date: f.date(a.nextServiceOn) })) : t("eq.noInterval")}
                  </span>
                  <span className="flex gap-1">
                    <IconButton label={t("eq.history")} variant="ghost" onClick={() => setOpen(a)}>
                      <ClockCounterClockwise size={18} aria-hidden />
                    </IconButton>
                    {ctx.can("assets.manage") && a.status !== "retired" ? (
                      <IconButton label={t("eq.edit")} variant="ghost" onClick={() => setEditing(a)}>
                        <PencilSimple size={18} aria-hidden />
                      </IconButton>
                    ) : null}
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {open ? <HistoryDialog ctx={ctx} asset={open} onClose={() => setOpen(null)} /> : null}
      {editing ? <AssetDialog ctx={ctx} asset={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

const toPoisha = (text: string): number | null => (/^\d{1,9}(\.\d{1,2})?$/.test(text.trim()) ? Math.round(Number(text) * 100) : null);
const takaText = (poisha: number | null | undefined) => (poisha == null ? "" : poisha % 100 ? (poisha / 100).toFixed(2) : String(poisha / 100));

function AssetDialog({ ctx, asset, onClose }: { ctx: GymCtx; asset?: Asset; onClose: () => void }) {
  const t = useTranslations("gt");
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const today = dhakaToday();
  const [d, setD] = useState({
    name: asset?.name ?? "",
    category: (asset?.category ?? "cardio") as AssetCategory,
    brand: asset?.brand ?? "",
    serial: asset?.serial ?? "",
    location: asset?.location ?? "",
    boughtOn: asset?.boughtOn ?? "",
    cost: takaText(asset?.costPoisha),
    every: asset?.serviceEveryDays ? String(asset.serviceEveryDays) : "",
    lastServiceOn: "",
    status: (asset?.status ?? "working") as AssetStatus,
    note: asset?.note ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = async () => {
    if (!d.name.trim()) return setProblem(t("eq.nameNeeded"));
    const cost = d.cost.trim() ? toPoisha(d.cost) : null;
    if (d.cost.trim() && cost === null) return setProblem(t("eq.costBad"));
    const every = d.every.trim() ? Number(d.every) : null;
    if (every !== null && (!Number.isInteger(every) || every < 1 || every > 3650)) return setProblem(t("eq.everyBad"));
    const body: AssetInput = {
      name: d.name.trim(),
      category: d.category,
      brand: d.brand.trim() || null,
      serial: d.serial.trim() || null,
      location: d.location.trim() || null,
      boughtOn: d.boughtOn || null,
      costPoisha: cost,
      serviceEveryDays: every,
      note: d.note.trim() || null,
    };
    setBusy(true);
    setProblem(null);
    try {
      if (asset) await gymStaff.editAsset(ctx.gymId, asset.id, { ...body, ...(d.status !== asset.status ? { status: d.status } : {}) });
      else await gymStaff.addAsset(ctx.gymId, { ...body, lastServiceOn: d.lastServiceOn || null });
      toast.show(t("eq.saved"));
      void qc.invalidateQueries({ queryKey: ["gt-assets", ctx.gymId] });
      onClose();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()} title={asset ? t("eq.editTitle") : t("eq.add")} className="max-w-2xl">
      <div className="grid gap-3 px-6 pb-5 sm:grid-cols-2">
        <Field id="as-name" label={t("eq.name")} value={d.name} maxLength={80} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder={t("eq.namePh")} className="sm:col-span-2" autoFocus />
        <Select id="as-cat" label={t("eq.category")} value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as AssetCategory })}>
          {ASSET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`eq.cat.${c}`)}
            </option>
          ))}
        </Select>
        <Field id="as-loc" label={t("eq.location")} optional={t("optional")} value={d.location} maxLength={60} onChange={(e) => setD({ ...d, location: e.target.value })} placeholder={t("eq.locationPh")} />
        <Field id="as-brand" label={t("eq.brand")} optional={t("optional")} value={d.brand} maxLength={60} onChange={(e) => setD({ ...d, brand: e.target.value })} />
        <Field id="as-serial" label={t("eq.serial")} optional={t("optional")} value={d.serial} maxLength={60} onChange={(e) => setD({ ...d, serial: e.target.value })} />
        <Field id="as-bought" type="date" label={t("eq.boughtOn")} optional={t("optional")} value={d.boughtOn} max={today} onChange={(e) => setD({ ...d, boughtOn: e.target.value })} />
        <Field id="as-cost" label={t("eq.cost")} optional={t("optional")} inputMode="decimal" leading="৳" value={d.cost} onChange={(e) => setD({ ...d, cost: e.target.value })} />
        <Field id="as-every" label={t("eq.every")} optional={t("optional")} inputMode="numeric" value={d.every} onChange={(e) => setD({ ...d, every: e.target.value.replace(/\D/g, "").slice(0, 4) })} hint={t("eq.everyHint")} />
        {asset ? (
          <Select id="as-status" label={t("eq.statusLabel")} value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as AssetStatus })}>
            {(["working", "needs_service", "out_of_order", "retired"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`eq.status.${s}`)}
              </option>
            ))}
          </Select>
        ) : (
          <Field id="as-last" type="date" label={t("eq.lastService")} optional={t("optional")} value={d.lastServiceOn} max={today} onChange={(e) => setD({ ...d, lastServiceOn: e.target.value })} />
        )}
        <Textarea id="as-note" label={t("eq.note")} optional={t("optional")} value={d.note} maxLength={300} onChange={(e) => setD({ ...d, note: e.target.value })} className="sm:col-span-2" />
        {asset && d.status === "retired" ? <Notice tone="warning" className="sm:col-span-2">{t("eq.retireWarn")}</Notice> : null}
        {problem ? (
          <p role="alert" className="text-sm text-danger sm:col-span-2">
            {problem}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button
            onClick={() => void save()}
            busy={busy}
            confirm={!asset ? "add" : d.status === "retired" && asset.status !== "retired" ? { kind: "remove", title: t("eq.retireAsk", { name: d.name.trim() || asset.name }), body: t("eq.retireWarn") } : "save"}
            data-testid="asset-save"
          >
            {t("save")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function HistoryDialog({ ctx, asset, onClose }: { ctx: GymCtx; asset: Asset; onClose: () => void }) {
  const t = useTranslations("gt");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["gt-asset-logs", ctx.gymId, asset.id], queryFn: () => gymStaff.assetLogs(ctx.gymId, asset.id) });
  const [kind, setKind] = useState<"service" | "repair" | "note">("service");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [asExpense, setAsExpense] = useState(true);
  const [method, setMethod] = useState<PayMethod>("cash");
  const [key, setKey] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const canLog = ctx.can("assets.manage") && (q.data?.asset.status ?? asset.status) !== "retired";
  const save = async () => {
    const costPoisha = cost.trim() ? toPoisha(cost) : null;
    if (cost.trim() && !costPoisha) return setProblem(t("eq.costBad"));
    if (kind === "note" && !note.trim()) return setProblem(t("eq.noteNeeded"));
    setBusy(true);
    setProblem(null);
    try {
      await gymStaff.addAssetLog(ctx.gymId, asset.id, { kind, costPoisha, note: note.trim() || null, ...(costPoisha && asExpense && kind !== "note" ? { expense: { method } } : {}) }, key);
      toast.show(t("eq.logged"));
      setCost("");
      setNote("");
      setKey(newKey());
      void qc.invalidateQueries({ queryKey: ["gt-asset-logs", ctx.gymId, asset.id] });
      void qc.invalidateQueries({ queryKey: ["gt-assets", ctx.gymId] });
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  const a = q.data?.asset ?? asset;
  const spend = kind !== "note" && asExpense && cost.trim() ? toPoisha(cost) : null;
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()} title={a.name} description={[t(`eq.status.${a.status}`), a.nextServiceOn ? t("eq.nextService", { date: f.date(a.nextServiceOn) }) : null].filter(Boolean).join(" · ")} className="max-w-2xl">
      <div className="flex flex-col gap-4 px-6 pb-5">
        {canLog ? (
          <Card className="flex flex-col gap-3" data-testid="asset-log-form">
            <SegmentedControl
              label={t("eq.logKind")}
              value={kind}
              onChange={setKind}
              options={(["service", "repair", "note"] as const).map((k) => ({ value: k, label: t(`eq.kind.${k}`) }))}
            />
            {kind !== "note" ? <Field id="lg-cost" label={t("eq.costOf")} optional={t("optional")} inputMode="decimal" leading="৳" value={cost} onChange={(e) => setCost(e.target.value)} /> : null}
            {kind !== "note" && cost.trim() ? (
              <div className="flex flex-wrap items-end gap-3">
                <Checkbox id="lg-exp" label={t("eq.asExpense")} checked={asExpense} onChange={(e) => setAsExpense(e.target.checked)} />
                {asExpense ? (
                  <Select id="lg-method" label={t("payroll.method")} value={method} onChange={(e) => setMethod(e.target.value as PayMethod)} className="w-48">
                    {PAY_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {t(`method.${m}`)}
                      </option>
                    ))}
                  </Select>
                ) : null}
              </div>
            ) : null}
            <Textarea id="lg-note" label={t("eq.note")} optional={kind === "note" ? undefined : t("optional")} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
            {kind === "service" ? <p className="text-xs text-muted">{t("eq.serviceHint")}</p> : null}
            {problem ? (
              <p role="alert" className="text-sm text-danger">
                {problem}
              </p>
            ) : null}
            <Button
              className="self-start"
              onClick={() => void save()}
              busy={busy}
              confirm={spend ? { kind: "money", title: t("eq.logSpendAsk", { amount: f.taka(spend) }), body: t("eq.logSpendBody", { method: t(`method.${method}`) }) } : "add"}
              data-testid="asset-log-save"
            >
              <Wrench size={18} aria-hidden />
              {t("eq.log")}
            </Button>
          </Card>
        ) : null}
        <div>
          <h3 className="text-sm font-semibold">{t("eq.history")}</h3>
          {q.isPending ? (
            <SkeletonList rows={3} />
          ) : q.isError ? (
            <Notice tone="error">{err(q.error)}</Notice>
          ) : !q.data.items.length ? (
            <p className="mt-1 text-sm text-muted">{t("eq.noHistory")}</p>
          ) : (
            <ul className="mt-1 divide-y divide-line" data-testid="asset-logs">
              {q.data.items.map((x) => (
                <li key={x.id} className="flex flex-col gap-0.5 py-2 text-sm">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      {x.kind === "status" ? t("eq.statusTo", { status: t(`eq.status.${x.statusAfter ?? "working"}`) }) : t(`eq.kind.${x.kind}`)}
                    </span>
                    <span className="text-xs text-muted">{f.date(x.doneOn)}</span>
                  </span>
                  {x.costPoisha ? (
                    <span className="text-muted">
                      {f.taka(x.costPoisha)}
                      {x.expenseId ? ` · ${t("eq.inExpenses")}` : ""}
                    </span>
                  ) : null}
                  {x.note ? <span className="text-muted">{x.note}</span> : null}
                  <span className="text-xs text-muted">{x.by.displayName ?? "–"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}
