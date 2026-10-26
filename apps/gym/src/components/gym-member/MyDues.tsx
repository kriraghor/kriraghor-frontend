"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CheckCircle, CreditCard, Storefront } from "@phosphor-icons/react";
import { useAuth } from "@kriraghor/ui/auth";
import { SignedOutCard } from "@kriraghor/ui/account";
import { newKey } from "@kriraghor/ui/format";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { Badge, Button, Card, EmptyState, Notice, Skeleton } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { gymMoney, payPath, type MyDue } from "@/lib/gym-money";
import { useFmt, useGymError } from "@/components/gym-manage/common";

/** GET /me/gym-dues: my outstanding dues across gyms (shared by /me/dues, /me and one membership). */
export function useMyDues() {
  const { status } = useAuth();
  return useQuery({ queryKey: ["my-gym-dues"], queryFn: () => gymMoney.myDues(), enabled: status === "signed_in" });
}

/**
 * **Pay** one of my dues online (M24-FR-41): POST /me/gym-dues/:dueId/pay (one key per button), then
 * the pay page here. Only when the gym takes fees online; otherwise "Pay at the counter" with why.
 */
export function PayDueButton({ due, size = "md", block }: { due: Pick<MyDue, "dueId" | "outstandingPoisha" | "onlineFees" | "onlineFeesReason">; size?: "sm" | "md" | "lg"; block?: boolean }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const router = useRouter();
  const [key] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!due.onlineFees)
    return (
      <p className="flex items-start gap-1.5 text-xs text-muted" data-testid="due-counter">
        <Storefront size={16} className="shrink-0" aria-hidden />
        <span>
          {t("me.payCounter")} {due.onlineFeesReason ? t(`me.offlineWhy.${due.onlineFeesReason}`) : null}
        </span>
      </p>
    );
  const pay = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const r = await gymMoney.payMyDue(due.dueId, key);
      const to = payPath(r.payUrl);
      if (to.startsWith("/")) router.push(to);
      else window.location.assign(to);
    } catch (e) {
      setProblem(err(e));
      setBusy(false);
    }
  };
  return (
    <div className={cn("flex flex-col gap-1", block && "w-full")}>
      <Button type="button" size={size} block={block} icon={<CreditCard size={18} aria-hidden />} busy={busy} onClick={() => void pay()} data-testid="due-pay">
        {t("me.payAmount", { amount: f.taka(due.outstandingPoisha) })}
      </Button>
      {problem ? (
        <p role="alert" className="text-xs text-danger">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

/** /me/dues (M24 §4.1): what I owe across gyms, oldest first, each with **Pay** or "Pay at the counter". */
export function MyDues() {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const { status } = useAuth();
  const q = useMyDues();
  if (status === "signed_out") return <SignedOutCard signInHref="/sign-in?next=/me/dues" />;
  const items = q.data?.items ?? [];
  const total = items.reduce((s, d) => s + d.outstandingPoisha, 0);
  return (
    <section className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-6 md:py-10" data-testid="me-dues-page">
      <h1 className="font-display text-3xl font-extrabold">{t("me.dues")}</h1>
      <p className="mt-1 text-sm text-muted">{t("me.duesLead")}</p>
      <div className="mt-6">
        {q.isPending ? (
          <Skeleton className="h-40 rounded-card" />
        ) : q.isError ? (
          <Notice tone="error">{err(q.error)}</Notice>
        ) : !items.length ? (
          <EmptyState icon={<CheckCircle size={32} aria-hidden />} title={t("me.noDues")} body={t("me.noDuesBody")} />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              {t("me.duesTotal", { amount: f.taka(total) })}
            </p>
            <ul className="grid gap-3 md:grid-cols-2" data-testid="me-dues-list">
              {items.map((d) => (
                <li key={d.dueId}>
                  <Card className={cn("flex h-full flex-col gap-2", d.overdue && "border-danger/50")} data-testid="me-due">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/me/memberships/${d.memberId}`} className="block truncate font-display text-lg font-bold hover:underline">
                          {d.gym?.name ?? t("me.gym")}
                        </Link>
                        <p className="text-xs text-muted tabular-nums">{d.memberCode}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Badge tone="warning">{t(`dueStatus.${d.status}`)}</Badge>
                        {d.overdue ? <Badge tone="danger">{t("flag.overdue")}</Badge> : null}
                      </div>
                    </div>
                    {d.membership ? (
                      <p className="text-sm">
                        <span className="font-semibold">{d.membership.title}</span> · {f.short(d.membership.startsOn)} – {f.short(d.membership.endsOn)}
                      </p>
                    ) : null}
                    <p className="text-sm text-muted">{t("profile.dueOn", { date: f.date(d.dueOn) })}</p>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm text-muted">{d.paidPoisha ? t("me.paidOf", { paid: f.taka(d.paidPoisha), amount: f.taka(d.amountPoisha) }) : t("money.outstandingLabel")}</span>
                      <span className="font-display text-2xl font-extrabold tabular-nums" data-testid="me-due-outstanding">
                        {f.taka(d.outstandingPoisha)}
                      </span>
                    </div>
                    <div className="mt-auto">
                      <PayDueButton due={d} block />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
