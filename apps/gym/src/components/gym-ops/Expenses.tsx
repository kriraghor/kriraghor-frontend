"use client";

import { useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CaretLeft, CaretRight, DotsThreeVertical, Plus, Tag, Wallet } from "@phosphor-icons/react";
import { Badge, Button, Card, Checkbox, Dialog, EmptyState, Field, IconButton, Menu, Notice, ReasonDialog, Select, SkeletonList, Textarea, useConfirm, useToast } from "@kriraghor/ui/kit";
import { DatePicker } from "@kriraghor/ui/date";
import { newKey } from "@kriraghor/ui/format";
import { cn } from "@kriraghor/ui/cn";
import { dhakaToday, takaToPoisha } from "@/lib/gym-manage";
import { EXPENSE_METHODS, gymOps, monthRange, previousMonth, type Expense, type ExpenseCategory, type ExpenseMethod } from "@/lib/gym-ops";
import { GymPage, useFmt, useGymError, type GymCtx } from "../gym-manage/common";

/**
 * /manage/[gymId]/expenses (M27-FR-01 to FR-05): what the gym spends, month by month, by category. Staff
 * with expenses.manage record and void (with a reason; nothing is deleted); reports.view reads. A cash
 * expense can come out of today's drawer. The owner renames, adds and retires categories.
 */
export function Expenses({ gymId }: { gymId: string }) {
  const t = useTranslations("go");
  return (
    <GymPage gymId={gymId} page="expenses" feature="expenses" title={t("expenses.title")} description={t("expenses.lead")} testId="go-expenses">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("go");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const today = dhakaToday();
  const [month, setMonth] = useState(monthRange(today));
  const [categoryId, setCategoryId] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingCats, setEditingCats] = useState(false);
  const [voiding, setVoiding] = useState<Expense | null>(null);
  const [voidBusy, setVoidBusy] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const canWrite = ctx.can("expenses.manage");
  const cats = useQuery({ queryKey: ["go-cats", ctx.gymId], queryFn: () => gymOps.categories(ctx.gymId) });
  const q = useInfiniteQuery({
    queryKey: ["go-expenses", ctx.gymId, month.from, categoryId],
    queryFn: ({ pageParam }) => gymOps.expenses(ctx.gymId, { from: month.from, to: month.to, ...(categoryId ? { categoryId } : {}), ...(pageParam ? { cursor: pageParam } : {}), limit: 50 }),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  const total = q.data?.pages[0]?.totalPoisha ?? 0;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["go-expenses", ctx.gymId] });
    void qc.invalidateQueries({ queryKey: ["go-drawer", ctx.gymId] });
    void qc.invalidateQueries({ queryKey: ["go-pnl", ctx.gymId] });
  };
  const byCategory = new Map<string, number>();
  for (const r of rows) if (r.status === "recorded") byCategory.set(r.category.name, (byCategory.get(r.category.name) ?? 0) + r.amountPoisha);
  const isThisMonth = month.from === monthRange(today).from;
  const next = () => {
    const [y, m] = month.from.split("-").map(Number);
    setMonth(monthRange(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`));
  };

  const confirmVoid = async (reason: string) => {
    if (!voiding) return;
    setVoidBusy(true);
    setVoidError(null);
    try {
      await gymOps.voidExpense(ctx.gymId, voiding.id, reason);
      toast.show(t("expenses.voided"));
      setVoiding(null);
      refresh();
    } catch (e) {
      setVoidError(err(e));
    } finally {
      setVoidBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconButton label={t("prevMonth")} variant="secondary" onClick={() => setMonth(previousMonth(month.from))}>
            <CaretLeft size={18} aria-hidden />
          </IconButton>
          <p className="min-w-36 text-center font-display text-lg font-bold" aria-live="polite">
            {f.month(month.from.slice(0, 7))}
          </p>
          <IconButton label={t("nextMonth")} variant="secondary" onClick={next} disabled={isThisMonth}>
            <CaretRight size={18} aria-hidden />
          </IconButton>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Select id="exp-cat" label={t("expenses.category")} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-52">
            <option value="">{t("expenses.allCategories")}</option>
            {(cats.data?.items ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {ctx.owner ? (
            <Button variant="secondary" onClick={() => setEditingCats(true)} data-testid="exp-cats">
              <Tag size={18} aria-hidden />
              {t("expenses.categories")}
            </Button>
          ) : null}
          {canWrite ? (
            <Button onClick={() => setAdding(true)} data-testid="exp-add">
              <Plus size={18} weight="bold" aria-hidden />
              {t("expenses.add")}
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="grid gap-3 sm:grid-cols-[minmax(0,240px)_1fr] sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("expenses.total")}</p>
          <p className="font-display text-3xl font-extrabold tabular-nums" data-testid="exp-total">
            {f.taka(total)}
          </p>
        </div>
        {byCategory.size ? (
          <ul className="flex flex-wrap gap-2">
            {[...byCategory.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([name, amount]) => (
                <li key={name} className="rounded-full border border-line px-3 py-1 text-sm">
                  <span className="text-muted">{name}</span> <span className="font-semibold tabular-nums">{f.taka(amount)}</span>
                </li>
              ))}
          </ul>
        ) : null}
      </Card>

      {q.isPending ? (
        <SkeletonList rows={5} />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Wallet size={28} aria-hidden />} title={t("expenses.empty")} body={canWrite ? t("expenses.emptyHint") : undefined} />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line" data-testid="exp-list">
            {rows.map((r) => (
              <li key={r.id} className={cn("flex items-center gap-3 px-4 py-3", r.status === "void" && "opacity-60")}>
                <div className="w-16 shrink-0 text-sm text-muted tabular-nums">{f.short(r.spentOn)}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {r.category.name}
                    {r.payee ? <span className="font-normal text-muted"> · {r.payee}</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {t(`method.${r.method}`)}
                    {r.fromDrawer ? ` · ${t("expenses.fromDrawerShort")}` : ""}
                    {r.note ? ` · ${r.note}` : ""}
                    {r.status === "void" && r.voidReason ? ` · ${t("expenses.voidBecause", { reason: r.voidReason })}` : ""}
                  </p>
                </div>
                {r.status === "void" ? <Badge tone="neutral">{t("expenses.void")}</Badge> : null}
                <p className={cn("font-semibold tabular-nums", r.status === "void" && "line-through")}>{f.taka(r.amountPoisha)}</p>
                {canWrite && r.status === "recorded" ? (
                  <Menu
                    trigger={
                      <IconButton label={t("more")} variant="ghost">
                        <DotsThreeVertical size={20} weight="bold" aria-hidden />
                      </IconButton>
                    }
                    items={[{ label: t("expenses.voidAction"), danger: true, onSelect: () => setVoiding(r) }]}
                  />
                ) : (
                  <span className="w-10" aria-hidden />
                )}
              </li>
            ))}
          </ul>
          {q.hasNextPage ? (
            <div className="border-t border-line p-3 text-center">
              <Button variant="ghost" onClick={() => void q.fetchNextPage()} busy={q.isFetchingNextPage}>
                {t("loadMore")}
              </Button>
            </div>
          ) : null}
        </Card>
      )}

      {adding ? <AddExpense ctx={ctx} categories={(cats.data?.items ?? []).filter((c) => c.status === "active")} onClose={() => setAdding(false)} onDone={refresh} /> : null}
      {editingCats && cats.data ? (
        <CategoriesDialog
          ctx={ctx}
          categories={cats.data.items}
          onClose={() => setEditingCats(false)}
          onDone={() => {
            void qc.invalidateQueries({ queryKey: ["go-cats", ctx.gymId] });
            refresh();
          }}
        />
      ) : null}
      <ReasonDialog
        open={Boolean(voiding)}
        onOpenChange={(o) => {
          if (!o) {
            setVoiding(null);
            setVoidError(null);
          }
        }}
        title={t("expenses.voidTitle")}
        description={voiding ? t("expenses.voidBody", { amount: f.taka(voiding.amountPoisha), category: voiding.category.name }) : undefined}
        confirmLabel={t("expenses.voidAction")}
        danger
        busy={voidBusy}
        error={voidError}
        onConfirm={(reason) => void confirmVoid(reason)}
        testId="exp-void"
      />
    </div>
  );
}

function AddExpense({ ctx, categories, onClose, onDone }: { ctx: GymCtx; categories: ExpenseCategory[]; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("go");
  const err = useGymError();
  const toast = useToast();
  const today = dhakaToday();
  const f = useFmt();
  const ask = useConfirm();
  const [key] = useState(newKey);
  const [d, setD] = useState({ categoryId: categories[0]?.id ?? "", taka: "", spentOn: today, method: "cash" as ExpenseMethod, fromDrawer: true, payee: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const amount = takaToPoisha(d.taka);
  const save = async () => {
    setProblem(null);
    if (!d.categoryId) return setProblem(t("expenses.pickCategory"));
    if (amount == null) return setProblem(t("amountBad"));
    const fromDrawer = d.method === "cash" && d.spentOn === today && d.fromDrawer;
    const category = categories.find((c) => c.id === d.categoryId)?.name ?? "";
    if (!(await ask({ kind: "money", title: t("expenses.addAsk", { amount: f.taka(amount), category }), body: fromDrawer ? t("expenses.fromDrawer") : undefined }))) return;
    setBusy(true);
    try {
      await gymOps.addExpense(
        ctx.gymId,
        { categoryId: d.categoryId, amountPoisha: amount, spentOn: d.spentOn, method: d.method, fromDrawer: d.method === "cash" && d.spentOn === today && d.fromDrawer, payee: d.payee.trim() || null, note: d.note.trim() || null },
        key,
      );
      toast.show(t("expenses.saved"));
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
      title={t("expenses.add")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void save()} busy={busy} data-testid="exp-save">
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 px-6 pb-2 sm:grid-cols-2">
        <Select id="exp-new-cat" label={t("expenses.category")} value={d.categoryId} onChange={(e) => setD({ ...d, categoryId: e.target.value })} className="sm:col-span-2">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Field id="exp-new-amount" label={t("amount")} inputMode="decimal" leading="৳" value={d.taka} onChange={(e) => setD({ ...d, taka: e.target.value })} data-testid="exp-amount" autoFocus />
        <DatePicker id="exp-new-date" label={t("expenses.date")} value={d.spentOn} max={today} clearable={false} onChange={(v) => v && setD({ ...d, spentOn: v })} />
        <Select id="exp-new-method" label={t("expenses.paidBy")} value={d.method} onChange={(e) => setD({ ...d, method: e.target.value as ExpenseMethod })}>
          {EXPENSE_METHODS.map((m) => (
            <option key={m} value={m}>
              {t(`method.${m}`)}
            </option>
          ))}
        </Select>
        <Field id="exp-new-payee" label={t("expenses.payee")} optional={t("optional")} value={d.payee} maxLength={80} onChange={(e) => setD({ ...d, payee: e.target.value })} />
        {d.method === "cash" && d.spentOn === today ? (
          <Checkbox id="exp-new-drawer" label={t("expenses.fromDrawer")} checked={d.fromDrawer} onChange={(e) => setD({ ...d, fromDrawer: e.target.checked })} className="sm:col-span-2" />
        ) : null}
        <Textarea id="exp-new-note" label={t("note")} optional={t("optional")} value={d.note} maxLength={300} onChange={(e) => setD({ ...d, note: e.target.value })} className="sm:col-span-2" />
        {problem ? (
          <p role="alert" className="text-sm text-danger sm:col-span-2">
            {problem}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

type CatDraft = { id?: string; name: string; status: "active" | "retired" };

function CategoriesDialog({ ctx, categories, onClose, onDone }: { ctx: GymCtx; categories: ExpenseCategory[]; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("go");
  const err = useGymError();
  const toast = useToast();
  const [list, setList] = useState<CatDraft[]>(() => categories.map((c) => ({ id: c.id, name: c.name, status: c.status })));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = async () => {
    const clean = list.map((c) => ({ ...c, name: c.name.trim() })).filter((c) => c.id || c.name);
    if (clean.some((c) => !c.name)) return setProblem(t("expenses.nameNeeded"));
    setBusy(true);
    setProblem(null);
    try {
      await gymOps.saveCategories(ctx.gymId, clean);
      toast.show(t("expenses.categoriesSaved"));
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
      title={t("expenses.categories")}
      description={t("expenses.categoriesHint")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void save()} busy={busy} confirm="save">
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2 px-6 pb-2">
        {list.map((c, i) => (
          <div key={c.id ?? `new-${i}`} className="flex items-end gap-2">
            <Field
              id={`cat-${i}`}
              label={t("expenses.categoryName")}
              value={c.name}
              maxLength={60}
              disabled={c.status === "retired"}
              onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              className="flex-1"
            />
            <Button variant="ghost" size="sm" onClick={() => setList(list.map((x, j) => (j === i ? { ...x, status: x.status === "active" ? "retired" : "active" } : x)))}>
              {c.status === "active" ? t("expenses.retire") : t("expenses.restore")}
            </Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" className="self-start" onClick={() => setList([...list, { name: "", status: "active" }])}>
          <Plus size={16} aria-hidden />
          {t("expenses.addCategory")}
        </Button>
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
