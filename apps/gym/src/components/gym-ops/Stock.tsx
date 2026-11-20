"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Archive, DotsThreeVertical, ImageSquare, Plus, Warning } from "@phosphor-icons/react";
import { Badge, Button, Card, Checkbox, Dialog, EmptyState, Field, IconButton, Menu, Notice, Select, SegmentedControl, SkeletonList, Textarea, useToast } from "@kriraghor/ui/kit";
import { DatePicker } from "@kriraghor/ui/date";
import { newKey } from "@kriraghor/ui/format";
import { cn } from "@kriraghor/ui/cn";
import { dhakaToday, poishaToTakaText, takaToPoisha } from "@/lib/gym-manage";
import { daysLeft, gymOps, PRODUCT_CATEGORIES, type Product, type ProductCategory, type ProductInput, type StockInput } from "@/lib/gym-ops";
import { amountProblem, nameProblem, photoProblem, wholeProblem } from "@/lib/validate";
import { GymPage, useFmt, useGymError, type GymCtx } from "../gym-manage/common";
import { PhotoPicker } from "./PhotoPicker";

/**
 * /manage/[gymId]/stock (M27-FR-10 to FR-16; stock.manage, Standard plan): the products the counter sells,
 * with price, cost and margin, stock, the reorder level, and for supplements the batch, expiry and importer
 * or BSTI details. Stock in (a new batch replaces the product's batch, expiry and cost), adjust or write
 * off with a note; every change is kept. Low stock and stock near its date are flagged. Each product may
 * have a photo, and every change asks first (tester feedback, 19 Nov 2026).
 */
export function Stock({ gymId }: { gymId: string }) {
  const t = useTranslations("go");
  return (
    <GymPage gymId={gymId} page="stock" feature="pos" title={t("stock.title")} description={t("stock.lead")} testId="go-stock">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

type View = "active" | "low" | "retired";

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("go");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const today = dhakaToday();
  const [view, setView] = useState<View>("active");
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [stocking, setStocking] = useState<Product | null>(null);
  const q = useQuery({
    queryKey: ["go-products", ctx.gymId, view],
    queryFn: () => gymOps.products(ctx.gymId, view === "retired" ? { status: "retired" } : view === "low" ? { status: "active", low: true } : { status: "active" }),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["go-products", ctx.gymId] });
  const items = (q.data?.items ?? []).filter((p) => !text.trim() || p.name.toLowerCase().includes(text.trim().toLowerCase()) || (p.barcode ?? "").includes(text.trim()));
  const setStatus = async (p: Product, status: "active" | "retired") => {
    try {
      await gymOps.editProduct(ctx.gymId, p.id, { status });
      toast.show(status === "retired" ? t("stock.retired") : t("stock.restored"));
      refresh();
    } catch (e) {
      toast.show(err(e), "error");
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SegmentedControl
          label={t("stock.view")}
          value={view}
          onChange={setView}
          options={[
            { value: "active", label: t("stock.viewActive") },
            { value: "low", label: t("stock.viewLow") },
            { value: "retired", label: t("stock.viewRetired") },
          ]}
        />
        <div className="flex flex-wrap items-end gap-2">
          <Field id="stock-find" label={t("stock.find")} value={text} onChange={(e) => setText(e.target.value)} className="w-56" />
          <Button onClick={() => setEditing("new")} data-testid="stock-add">
            <Plus size={18} weight="bold" aria-hidden />
            {t("stock.add")}
          </Button>
        </div>
      </div>
      {q.isPending ? (
        <SkeletonList rows={5} />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : items.length === 0 ? (
        <EmptyState icon={<Archive size={28} aria-hidden />} title={view === "low" ? t("stock.noneLow") : t("stock.empty")} body={view === "active" && !text ? t("stock.emptyHint") : undefined} />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line" data-testid="stock-list">
            {items.map((p) => {
              const soon = p.expiresOn && !p.expired ? daysLeft(p.expiresOn, today) <= 30 : false;
              const margin = p.costPoisha != null ? p.pricePoisha - p.costPoisha : null;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                  <span className="inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-control bg-surface-2 text-muted">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <ImageSquare size={22} aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-muted">
                      {t(`category.${p.category}`)}
                      {p.barcode ? ` · ${p.barcode}` : ""}
                      {p.batchNo ? ` · ${t("stock.batch", { no: p.batchNo })}` : ""}
                      {p.expiresOn ? ` · ${t("stock.expires", { date: f.date(p.expiresOn) })}` : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.expired ? <Badge tone="danger">{t("stock.expiredTag")}</Badge> : soon ? <Badge tone="warning">{t("stock.expiringTag")}</Badge> : null}
                      {p.low ? (
                        <Badge tone="warning">
                          <Warning size={12} weight="fill" aria-hidden /> {t("stock.lowTag")}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold tabular-nums">{f.taka(p.pricePoisha)}</p>
                    {margin != null ? <p className="text-xs text-muted tabular-nums">{t("stock.margin", { amount: f.taka(margin) })}</p> : null}
                  </div>
                  <div className={cn("w-20 text-right", p.low && "text-warning")}>
                    <p className="font-display text-xl font-bold tabular-nums">{f.n(p.stockQty)}</p>
                    <p className="text-xs text-muted">{t("stock.inStock")}</p>
                  </div>
                  {p.status === "active" ? (
                    <Button variant="secondary" size="sm" onClick={() => setStocking(p)} data-testid={`stock-in-${p.id}`}>
                      {t("stock.stockIn")}
                    </Button>
                  ) : null}
                  <Menu
                    trigger={
                      <IconButton label={t("more")} variant="ghost">
                        <DotsThreeVertical size={20} weight="bold" aria-hidden />
                      </IconButton>
                    }
                    items={[
                      { label: t("stock.edit"), onSelect: () => setEditing(p) },
                      p.status === "active"
                        ? { label: t("stock.retire"), danger: true, confirm: { kind: "remove", title: t("stock.retireAsk", { name: p.name }), body: t("stock.retireBody") }, onSelect: () => void setStatus(p, "retired") }
                        : { label: t("stock.restore"), confirm: "save", onSelect: () => void setStatus(p, "active") },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {editing ? <ProductDialog ctx={ctx} product={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={refresh} /> : null}
      {stocking ? <StockDialog ctx={ctx} product={stocking} onClose={() => setStocking(null)} onDone={refresh} /> : null}
    </div>
  );
}

function ProductDialog({ ctx, product, onClose, onDone }: { ctx: GymCtx; product: Product | null; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("go");
  const err = useGymError();
  const toast = useToast();
  const [d, setD] = useState(() => ({
    name: product?.name ?? "",
    barcode: product?.barcode ?? "",
    category: (product?.category ?? "supplement") as ProductCategory,
    price: poishaToTakaText(product?.pricePoisha),
    cost: poishaToTakaText(product?.costPoisha),
    reorderLevel: String(product?.reorderLevel ?? 0),
    batchNo: product?.batchNo ?? "",
    expiresOn: product?.expiresOn ?? "",
    importer: product?.importer ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ file: File | null; removed: boolean }>({ file: null, removed: false });
  const supplement = d.category === "supplement" || d.category === "drink" || d.category === "snack";
  // Every field is checked before saving (19 Nov 2026); messages show once Save was tried.
  const [tried, setTried] = useState(false);
  const problems: Record<string, string> = {};
  const put = (k: string, p: string | null) => {
    if (p) problems[k] = p;
  };
  put("name", nameProblem(d.name, { min: 2, max: 80 }));
  put("price", amountProblem(d.price));
  put("cost", amountProblem(d.cost, { required: false, allowZero: true }));
  put("reorderLevel", wholeProblem(d.reorderLevel, { max: 100_000 }));
  put("photo", photoProblem(photo.file));
  const tc = useTranslations("gm.check");
  const shown = (k: string) => (tried && problems[k] ? tc(problems[k]) : undefined);
  const save = async () => {
    setTried(true);
    if (Object.keys(problems).length) return setProblem(tc("fix"));
    const price = takaToPoisha(d.price);
    const cost = d.cost.trim() ? takaToPoisha(d.cost, { allowZero: true }) : null;
    const reorder = Number(d.reorderLevel || "0");
    if (price == null) return setProblem(t("amountBad"));
    if (d.cost.trim() && cost == null) return setProblem(t("amountBad"));
    const body: ProductInput = {
      name: d.name.trim(),
      barcode: d.barcode.trim() || null,
      category: d.category,
      pricePoisha: price,
      costPoisha: cost,
      reorderLevel: reorder,
      batchNo: d.batchNo.trim() || null,
      expiresOn: d.expiresOn || null,
      importer: d.importer.trim() || null,
    };
    setBusy(true);
    setProblem(null);
    try {
      const saved = product ? await gymOps.editProduct(ctx.gymId, product.id, body) : await gymOps.addProduct(ctx.gymId, body);
      if (photo.file) await gymOps.productPhoto(ctx.gymId, saved.id, photo.file);
      else if (photo.removed && product?.photoUrl) await gymOps.removeProductPhoto(ctx.gymId, saved.id);
      toast.show(t("stock.saved"));
      onDone();
      onClose();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={product ? t("stock.editTitle") : t("stock.add")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void save()} busy={busy} confirm={Object.keys(problems).length ? undefined : product ? "save" : { kind: "add", title: t("stock.addAsk", { name: d.name.trim() }) }} data-testid="product-save">
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 px-6 pb-2 sm:grid-cols-2">
        <Field id="p-name" label={t("stock.name")} value={d.name} maxLength={80} onChange={(e) => setD({ ...d, name: e.target.value })} className="sm:col-span-2" autoFocus error={shown("name")} data-testid="product-name" />
        <div className="sm:col-span-2">
          <PhotoPicker label={t("stock.photo")} current={product?.photoUrl ?? null} file={photo.file} removed={photo.removed} onChange={(file, removed) => setPhoto({ file, removed })} error={shown("photo")} />
        </div>
        <Select id="p-cat" label={t("stock.category")} value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as ProductCategory })}>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`category.${c}`)}
            </option>
          ))}
        </Select>
        <Field id="p-barcode" label={t("stock.barcode")} optional={t("optional")} value={d.barcode} maxLength={40} onChange={(e) => setD({ ...d, barcode: e.target.value })} hint={t("stock.barcodeHint")} />
        <Field id="p-price" label={t("stock.price")} inputMode="decimal" leading="৳" value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} error={shown("price")} data-testid="product-price" />
        <Field id="p-cost" label={t("stock.cost")} optional={t("optional")} inputMode="decimal" leading="৳" value={d.cost} onChange={(e) => setD({ ...d, cost: e.target.value })} hint={t("stock.costHint")} error={shown("cost")} />
        <Field id="p-reorder" label={t("stock.reorder")} inputMode="numeric" value={d.reorderLevel} onChange={(e) => setD({ ...d, reorderLevel: e.target.value.replace(/\D/g, "") })} hint={t("stock.reorderHint")} error={shown("reorderLevel")} />
        {supplement ? (
          <>
            <Field id="p-batch" label={t("stock.batchNo")} optional={t("optional")} value={d.batchNo} maxLength={40} onChange={(e) => setD({ ...d, batchNo: e.target.value })} />
            <DatePicker id="p-expiry" label={t("stock.expiry")} optional={t("optional")} value={d.expiresOn} onChange={(v) => setD({ ...d, expiresOn: v })} />
            <Field id="p-importer" label={t("stock.importer")} optional={t("optional")} value={d.importer} maxLength={120} onChange={(e) => setD({ ...d, importer: e.target.value })} hint={t("stock.importerHint")} />
          </>
        ) : null}
        {problem ? (
          <p role="alert" className="text-sm text-danger sm:col-span-2">
            {problem}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

function StockDialog({ ctx, product, onClose, onDone }: { ctx: GymCtx; product: Product; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("go");
  const f = useFmt();
  const err = useGymError();
  const toast = useToast();
  const [key] = useState(newKey);
  const [kind, setKind] = useState<StockInput["kind"]>("in");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [newBatch, setNewBatch] = useState(false);
  const [batchNo, setBatchNo] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = async () => {
    const n = Number(qty);
    if (!Number.isInteger(n) || n === 0 || (kind !== "adjust" && n < 0)) return setProblem(t("stock.qtyBad"));
    if (kind !== "in" && !note.trim()) return setProblem(t("stock.noteNeeded"));
    const unitCost = cost.trim() ? takaToPoisha(cost, { allowZero: true }) : null;
    if (cost.trim() && unitCost == null) return setProblem(t("amountBad"));
    setBusy(true);
    setProblem(null);
    try {
      const body: StockInput =
        kind === "in"
          ? { kind, qty: n, unitCostPoisha: unitCost, ...(newBatch ? { batchNo: batchNo.trim() || null, expiresOn: expiresOn || null } : {}), note: note.trim() || null }
          : { kind, qty: n, note: note.trim() };
      const p = await gymOps.stock(ctx.gymId, product.id, body, key);
      toast.show(t("stock.stockSaved", { n: f.n(p.stockQty) }));
      onDone();
      onClose();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={product.name}
      description={t("stock.nowInStock", { n: f.n(product.stockQty) })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void save()} busy={busy} confirm="save" data-testid="stock-save">
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 px-6 pb-2">
        <SegmentedControl
          label={t("stock.kind")}
          value={kind}
          onChange={setKind}
          options={[
            { value: "in", label: t("stock.kindIn") },
            { value: "adjust", label: t("stock.kindAdjust") },
            { value: "write_off", label: t("stock.kindWriteOff") },
          ]}
        />
        <Field
          id="s-qty"
          label={kind === "adjust" ? t("stock.qtyAdjust") : t("stock.qty")}
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(e.target.value.replace(kind === "adjust" ? /[^\d-]/g : /\D/g, ""))}
          hint={kind === "adjust" ? t("stock.qtyAdjustHint") : undefined}
          autoFocus
          data-testid="stock-qty"
        />
        {kind === "in" ? (
          <>
            <Field id="s-cost" label={t("stock.unitCost")} optional={t("optional")} inputMode="decimal" leading="৳" value={cost} onChange={(e) => setCost(e.target.value)} />
            <Checkbox id="s-batch" label={t("stock.newBatch")} checked={newBatch} onChange={(e) => setNewBatch(e.target.checked)} />
            {newBatch ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="s-batchno" label={t("stock.batchNo")} value={batchNo} maxLength={40} onChange={(e) => setBatchNo(e.target.value)} />
                <DatePicker id="s-expiry" label={t("stock.expiry")} optional={t("optional")} value={expiresOn} onChange={setExpiresOn} />
              </div>
            ) : null}
          </>
        ) : null}
        <Textarea id="s-note" label={t("note")} optional={kind === "in" ? t("optional") : undefined} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
