"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Barcode, Minus, Plus, ShoppingCart, Trash } from "@phosphor-icons/react";
import { Badge, Button, Card, Dialog, EmptyState, Field, IconButton, Notice, ReasonDialog, Select, SegmentedControl, SkeletonList, useToast } from "@kriraghor/ui/kit";
import { newKey } from "@kriraghor/ui/format";
import { cn } from "@kriraghor/ui/cn";
import { dhakaToday, takaToPoisha } from "@/lib/gym-manage";
import { addToCart, cartTotal, changeDue, cleanBarcode, gymOps, SALE_METHODS, setQty, type CartLine, type Product, type Sale, type SaleMethod } from "@/lib/gym-ops";
import { GymPage, useFmt, useGymError, type GymCtx } from "../gym-manage/common";
import { MemberPick, PrintBar, SaleReceipt, usePaper, type PickedMember } from "./parts";

/**
 * /manage/[gymId]/sell (M27-FR-17 to FR-21; pos.sell, Standard plan): the counter. Scan a barcode (a USB
 * scanner types it and presses Enter) or tap a product, set quantities, pick how they paid and, if it is
 * a member, who; the sale prints an 80 mm or A4 receipt from the gym's receipt series. Cash shows the
 * change. The day's sales sit below; a reversal needs fees.adjust too and puts the stock back.
 */
export function Sell({ gymId }: { gymId: string }) {
  const t = useTranslations("go");
  return (
    <GymPage gymId={gymId} page="sell" feature="pos" wide title={t("sell.title")} description={t("sell.lead")} testId="go-sell">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("go");
  const [tab, setTab] = useState<"counter" | "today">("counter");
  const [receipt, setReceipt] = useState<Sale | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label={t("sell.title")}
        value={tab}
        onChange={setTab}
        className="self-start"
        options={[
          { value: "counter", label: t("sell.counter"), testId: "sell-tab-counter" },
          { value: "today", label: t("sell.today"), testId: "sell-tab-today" },
        ]}
      />
      {tab === "counter" ? <Counter ctx={ctx} onSold={setReceipt} /> : <TodaySales ctx={ctx} onOpen={setReceipt} />}
      {receipt ? <ReceiptDialog ctx={ctx} sale={receipt} onClose={() => setReceipt(null)} onChanged={setReceipt} /> : null}
    </div>
  );
}

function Counter({ ctx, onSold }: { ctx: GymCtx; onSold: (s: Sale) => void }) {
  const t = useTranslations("go");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const scan = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<SaleMethod>("cash");
  const [member, setMember] = useState<PickedMember | null>(null);
  const [received, setReceived] = useState("");
  const [key, setKey] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const products = useQuery({ queryKey: ["go-products", ctx.gymId, "active"], queryFn: () => gymOps.products(ctx.gymId, { status: "active" }) });
  const list = useMemo(() => {
    const all = products.data?.items ?? [];
    const q = text.trim().toLowerCase();
    return q ? all.filter((p) => p.name.toLowerCase().includes(q) || (p.barcode ?? "").includes(q)) : all;
  }, [products.data, text]);
  const total = cartTotal(cart);
  const change = method === "cash" ? changeDue(total, received ? takaToPoisha(received, { allowZero: true }) : null) : null;

  const add = (p: Product) => {
    if (p.expired) return setProblem(t("sell.expired", { name: p.name }));
    if (p.stockQty <= 0) return setProblem(t("sell.outOfStock", { name: p.name }));
    setProblem(null);
    setCart((c) => addToCart(c, p));
  };
  // A USB scanner types the code and presses Enter: an exact barcode adds the product and clears the box.
  const onScan = (e: React.FormEvent) => {
    e.preventDefault();
    const code = cleanBarcode(text);
    const hit = (products.data?.items ?? []).find((p) => p.barcode && p.barcode === code);
    if (hit) {
      add(hit);
      setText("");
    } else if (list.length === 1) {
      add(list[0]);
      setText("");
    } else if (code) {
      setProblem(t("sell.noMatch", { code }));
    }
    scan.current?.focus();
  };
  const sell = async () => {
    if (!cart.length) return;
    setBusy(true);
    setProblem(null);
    try {
      const sale = await gymOps.sell(ctx.gymId, { lines: cart.map((l) => ({ productId: l.product.id, qty: l.qty })), method, ...(member ? { memberId: member.id } : {}) }, key);
      toast.show(t("sell.done", { no: sale.receiptNo }));
      setCart([]);
      setMember(null);
      setReceived("");
      setKey(newKey());
      void qc.invalidateQueries({ queryKey: ["go-products", ctx.gymId] });
      void qc.invalidateQueries({ queryKey: ["go-sales", ctx.gymId] });
      void qc.invalidateQueries({ queryKey: ["go-drawer", ctx.gymId] });
      onSold(sale);
    } catch (e) {
      setProblem(err(e));
      void qc.invalidateQueries({ queryKey: ["go-products", ctx.gymId] });
    } finally {
      setBusy(false);
      scan.current?.focus();
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
      <div className="flex flex-col gap-3">
        <form onSubmit={onScan}>
          <Field
            ref={scan}
            id="sell-scan"
            label={t("sell.scan")}
            hint={t("sell.scanHint")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            leading={<Barcode size={18} aria-hidden />}
            autoComplete="off"
            autoFocus
            data-testid="sell-scan"
          />
        </form>
        {products.isPending ? (
          <SkeletonList rows={4} />
        ) : products.isError ? (
          <Notice tone="error">{err(products.error)}</Notice>
        ) : list.length === 0 ? (
          <EmptyState icon={<ShoppingCart size={28} aria-hidden />} title={text ? t("sell.noneFound") : t("sell.noProducts")} body={ctx.can("stock.manage") && !text ? t("sell.addProductsHint") : undefined} />
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" data-testid="sell-products">
            {list.map((p) => {
              const inCart = cart.find((l) => l.product.id === p.id)?.qty ?? 0;
              const off = p.expired || p.stockQty <= 0;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => add(p)}
                    disabled={off}
                    className={cn(
                      "surface-card flex h-full w-full flex-col items-start gap-1 p-3 text-left transition-[border-color,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
                      inCart ? "border-brand" : "hover:border-line-strong",
                    )}
                    data-testid={`sell-product-${p.id}`}
                  >
                    <span className="line-clamp-2 font-semibold">{p.name}</span>
                    <span className="font-display text-lg font-bold tabular-nums">{f.taka(p.pricePoisha)}</span>
                    <span className="flex flex-wrap gap-1 text-xs text-muted">
                      {p.expired ? <Badge tone="danger">{t("sell.expiredTag")}</Badge> : p.stockQty <= 0 ? <Badge tone="danger">{t("sell.soldOut")}</Badge> : t("sell.left", { n: f.n(p.stockQty) })}
                      {inCart ? <Badge tone="brand">{t("sell.inCart", { n: f.n(inCart) })}</Badge> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Card className="flex flex-col gap-3 lg:sticky lg:top-24 lg:self-start" data-testid="sell-cart">
        <h2 className="font-display text-lg font-bold">{t("sell.cart")}</h2>
        {cart.length === 0 ? (
          <p className="text-sm text-muted">{t("sell.cartEmpty")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {cart.map((l) => (
              <li key={l.product.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{l.product.name}</p>
                  <p className="text-xs text-muted tabular-nums">{f.taka(l.product.pricePoisha)}</p>
                </div>
                <IconButton variant="secondary" label={t("sell.less")} onClick={() => setCart((c) => setQty(c, l.product.id, l.qty - 1))}>
                  {l.qty === 1 ? <Trash size={16} aria-hidden /> : <Minus size={16} aria-hidden />}
                </IconButton>
                <span className="w-8 text-center font-semibold tabular-nums">{f.n(l.qty)}</span>
                <IconButton variant="secondary" label={t("sell.more")} onClick={() => setCart((c) => setQty(c, l.product.id, l.qty + 1))} disabled={l.qty >= l.product.stockQty}>
                  <Plus size={16} aria-hidden />
                </IconButton>
                <span className="w-24 text-right font-semibold tabular-nums">{f.taka(l.qty * l.product.pricePoisha)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-baseline justify-between border-t border-line pt-3">
          <span className="font-semibold">{t("sell.total")}</span>
          <span className="font-display text-3xl font-extrabold tabular-nums" data-testid="sell-total">
            {f.taka(total)}
          </span>
        </div>
        <Select id="sell-method" label={t("sell.paidBy")} value={method} onChange={(e) => setMethod(e.target.value as SaleMethod)}>
          {SALE_METHODS.map((m) => (
            <option key={m} value={m}>
              {t(`method.${m}`)}
            </option>
          ))}
        </Select>
        {method === "cash" && cart.length ? (
          <div className="grid grid-cols-2 items-end gap-2">
            <Field id="sell-received" label={t("sell.received")} optional={t("optional")} inputMode="decimal" leading="৳" value={received} onChange={(e) => setReceived(e.target.value)} />
            <p className="pb-3 text-right text-sm" aria-live="polite">
              {change != null ? (
                <>
                  {t("sell.change")} <span className="font-bold tabular-nums">{f.taka(change)}</span>
                </>
              ) : null}
            </p>
          </div>
        ) : null}
        {ctx.can("members.view") ? <MemberPick gymId={ctx.gymId} id="sell-member" label={t("sell.member")} optional={t("optional")} value={member} onChange={setMember} /> : null}
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
        <Button size="lg" onClick={() => void sell()} busy={busy} disabled={!cart.length} confirm={{ kind: "money", title: t("sell.ask", { amount: f.taka(total), method: t(`method.${method}`) }), confirmLabel: t("sell.confirm", { amount: f.taka(total) }) }} data-testid="sell-confirm">
          {t("sell.confirm", { amount: f.taka(total) })}
        </Button>
      </Card>
    </div>
  );
}

function TodaySales({ ctx, onOpen }: { ctx: GymCtx; onOpen: (s: Sale) => void }) {
  const t = useTranslations("go");
  const f = useFmt();
  const err = useGymError();
  const today = dhakaToday();
  const q = useQuery({ queryKey: ["go-sales", ctx.gymId, today], queryFn: () => gymOps.sales(ctx.gymId, { date: today, limit: 100 }) });
  if (q.isPending) return <SkeletonList rows={4} />;
  if (q.isError) return <Notice tone="error">{err(q.error)}</Notice>;
  const items = q.data.items;
  const sum = items.filter((s) => s.status === "recorded").reduce((n, s) => n + s.totalPoisha, 0);
  if (!items.length) return <EmptyState icon={<ShoppingCart size={28} aria-hidden />} title={t("sell.noSalesToday")} />;
  return (
    <Card padded={false}>
      <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <span className="text-sm text-muted">{t("sell.todayCount", { n: f.n(items.length) })}</span>
        <span className="font-display text-xl font-bold tabular-nums">{f.taka(sum)}</span>
      </div>
      <ul className="divide-y divide-line" data-testid="sell-today">
        {items.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => onOpen(s)} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2", s.status === "reversed" && "opacity-60")}>
              <span className="w-14 shrink-0 text-sm text-muted tabular-nums">{f.time(s.createdAt)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{s.lines.map((l) => `${l.description} × ${f.n(l.qty)}`).join(", ")}</span>
                <span className="block text-xs text-muted">
                  {s.receiptNo} · {t(`method.${s.method}`)}
                  {s.kind === "locker" ? ` · ${t("sell.lockerFee")}` : ""}
                </span>
              </span>
              {s.status === "reversed" ? <Badge tone="neutral">{t("sell.reversed")}</Badge> : null}
              <span className={cn("font-semibold tabular-nums", s.status === "reversed" && "line-through")}>{f.taka(s.totalPoisha)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ReceiptDialog({ ctx, sale: given, onClose, onChanged }: { ctx: GymCtx; sale: Sale; onClose: () => void; onChanged: (s: Sale) => void }) {
  const t = useTranslations("go");
  // A sale from the day's list has no gym header: the receipt endpoint has it.
  const full = useQuery({ queryKey: ["go-receipt", ctx.gymId, given.id, given.status], queryFn: () => gymOps.receipt(ctx.gymId, given.id), enabled: !given.gym });
  const sale = given.gym ? given : (full.data ?? given);
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const [paper, setPaper] = usePaper();
  const [reversing, setReversing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const canReverse = sale.status === "recorded" && ctx.can("pos.sell") && ctx.can("fees.adjust");
  const reverse = async (reason: string) => {
    setBusy(true);
    setProblem(null);
    try {
      const s = await gymOps.reverse(ctx.gymId, sale.id, reason);
      toast.show(t("sell.reversedToast"));
      setReversing(false);
      onChanged(s);
      for (const k of ["go-sales", "go-products", "go-drawer", "go-lockers"]) void qc.invalidateQueries({ queryKey: [k, ctx.gymId] });
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Dialog
        open
        onOpenChange={(o) => !o && onClose()}
        title={t("receipt.title", { no: sale.receiptNo })}
        className="max-w-xl"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {canReverse ? (
              <Button variant="ghost" onClick={() => setReversing(true)} data-testid="sale-reverse">
                {t("sell.reverse")}
              </Button>
            ) : (
              <span />
            )}
            <PrintBar paper={paper} onPaper={setPaper} />
          </div>
        }
      >
        <div className="overflow-x-auto px-6 pb-2">
          <SaleReceipt sale={sale} paper={paper} />
        </div>
      </Dialog>
      <ReasonDialog
        open={reversing}
        onOpenChange={(o) => {
          if (!o) {
            setReversing(false);
            setProblem(null);
          }
        }}
        title={t("sell.reverseTitle")}
        description={t("sell.reverseBody")}
        confirmLabel={t("sell.reverse")}
        danger
        busy={busy}
        error={problem}
        onConfirm={(reason) => void reverse(reason)}
        testId="sale-reverse-dialog"
      />
    </>
  );
}
