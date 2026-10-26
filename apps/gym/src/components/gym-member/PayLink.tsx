"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Barbell, CreditCard, Receipt as ReceiptIcon } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { newKey } from "@kriraghor/ui/format";
import { useRouter } from "@kriraghor/ui/i18n/navigation";
import { Button, ButtonLink, Card, Checkbox, Notice, Skeleton } from "@kriraghor/ui/kit";
import { receiptPath } from "@/lib/gym-manage";
import { gymMoney, offerLink, payLinkView, payPath, type PayLinkSummary } from "@/lib/gym-money";
import { useFmt, useGymError } from "@/components/gym-manage/common";

/**
 * /p/[token] (M24 §4.1, FR-41): the payment link a gym sent or showed as a QR. The gym, the package,
 * the amount, the member code and first name, and the due date; **Pay** after signing in (anyone with a
 * verified phone may pay, e.g. a parent). "Link this membership to my account" only when the API says
 * the signed-in phone is the member's (off by default). Expired or cancelled → ask the gym for a new
 * link; paid → the receipt. Never indexed.
 */
export function PayLink({ token }: { token: string }) {
  const t = useTranslations("gm");
  const { status } = useAuth();
  const q = useQuery({ queryKey: ["gym-pay-link", token, status], queryFn: () => gymMoney.payLink(token), retry: false, enabled: status !== "loading" });
  const code = problemOf(q.error)?.code;
  return (
    <section className="mx-auto w-full max-w-[560px] px-4 py-6 sm:py-10" data-testid="pay-link">
      {q.isPending ? (
        <Skeleton className="h-80 rounded-card" />
      ) : code === "GYM_PAY_LINK_EXPIRED" ? (
        <Ended kind="expired" />
      ) : q.isError || !q.data ? (
        <Notice tone="warning" title={t("payLink.notFound")}>
          {t("payLink.notFoundBody")}
        </Notice>
      ) : (
        <Body s={q.data} token={token} signedIn={status === "signed_in"} />
      )}
    </section>
  );
}

function Ended({ kind }: { kind: "expired" | "cancelled" }) {
  const t = useTranslations("gm");
  return (
    <Notice tone="warning" title={t(`payLink.${kind}`)}>
      <span data-testid="pay-link-ended">{t("payLink.askNew")}</span>
    </Notice>
  );
}

function Body({ s, token, signedIn }: { s: PayLinkSummary; token: string; signedIn: boolean }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const router = useRouter();
  const view = payLinkView(s);
  const [link, setLink] = useState(false);
  const [key] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const next = encodeURIComponent(`/p/${token}`);
  const pay = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const r = await gymMoney.payByLink(token, offerLink(s.viewer) && link, key);
      const to = payPath(r.payUrl);
      if (to.startsWith("/")) router.push(to);
      else window.location.assign(to);
    } catch (e) {
      setProblem(err(e));
      setBusy(false);
    }
  };
  const receipt = receiptPath(s.receipt?.url);
  return (
    <div className="flex flex-col gap-4" data-view={view} data-testid="pay-link-body">
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-control bg-brand-soft text-brand-text">
            <Barbell size={24} weight="fill" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("payLink.from")}</p>
            <h1 className="break-words font-display text-2xl font-extrabold leading-tight" data-testid="pay-link-gym">
              {s.gym?.name ?? t("me.gym")}
            </h1>
          </div>
        </div>
        <dl className="divide-y divide-line text-sm">
          <div className="flex justify-between gap-3 py-2">
            <dt className="text-muted">{t("payLink.member")}</dt>
            <dd className="text-right font-semibold" data-testid="pay-link-member">
              {s.member.firstName} · <span className="tabular-nums">{s.member.memberCode}</span>
            </dd>
          </div>
          {s.membership ? (
            <div className="flex justify-between gap-3 py-2">
              <dt className="text-muted">{t("payLink.package")}</dt>
              <dd className="text-right font-semibold">
                {s.membership.title}
                <span className="block text-xs font-normal text-muted">
                  {f.date(s.membership.startsOn)} – {f.date(s.membership.endsOn)}
                </span>
              </dd>
            </div>
          ) : null}
          {s.dueOn ? (
            <div className="flex justify-between gap-3 py-2">
              <dt className="text-muted">{t("payLink.dueOn")}</dt>
              <dd className="text-right font-semibold">{f.date(s.dueOn)}</dd>
            </div>
          ) : null}
        </dl>
        <div className="flex items-baseline justify-between gap-3 rounded-control bg-surface-2 px-4 py-3">
          <span className="font-semibold">{t("payLink.amount")}</span>
          <span className="font-display text-3xl font-extrabold tabular-nums" data-testid="pay-link-amount">
            {f.taka(s.link.amountPoisha)}
          </span>
        </div>
        {view === "pay" ? <p className="text-xs text-muted">{t("payLink.expires", { date: f.date(s.link.expiresAt), time: f.time(s.link.expiresAt) })}</p> : null}
      </Card>
      {view === "paid" ? (
        <Notice tone="success" title={t("payLink.paid")}>
          {receipt ? (
            <a href={receipt} className="inline-flex min-h-9 items-center gap-1 font-semibold text-brand-text underline" data-testid="pay-link-receipt">
              <ReceiptIcon size={16} aria-hidden /> {t("money.openReceipt")}
            </a>
          ) : null}
        </Notice>
      ) : view === "expired" || view === "cancelled" ? (
        <Ended kind={view} />
      ) : view === "offline" ? (
        <Notice tone="warning" title={t("payLink.offline")}>
          {t("me.payCounter")}
        </Notice>
      ) : !signedIn ? (
        <Card className="flex flex-col gap-3" data-testid="pay-link-signin">
          <p className="text-sm">{t("payLink.signInFirst")}</p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/sign-in?next=${next}`} size="lg" data-testid="pay-link-sign-in">
              {t("payLink.signIn")}
            </ButtonLink>
            <ButtonLink href={`/signup?next=${next}`} size="lg" variant="secondary">
              {t("payLink.signUp")}
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {offerLink(s.viewer) ? (
            <Card padded={false} className="px-4 py-2">
              <Checkbox id="pay-link-account" label={t("payLink.linkAccount")} checked={link} onChange={(e) => setLink(e.target.checked)} data-testid="pay-link-account" />
              <p className="pb-2 text-xs text-muted">{t("payLink.linkAccountHint", { gym: s.gym?.name ?? t("me.gym") })}</p>
            </Card>
          ) : s.viewer?.linked ? (
            <p className="text-xs text-muted">{t("payLink.alreadyLinked")}</p>
          ) : null}
          <Button type="button" size="lg" block icon={<CreditCard size={20} aria-hidden />} busy={busy} onClick={() => void pay()} data-testid="pay-link-pay">
            {t("payLink.pay", { amount: f.taka(s.link.amountPoisha) })}
          </Button>
          <p className="text-center text-xs text-muted">{t("payLink.methods")}</p>
          {problem ? (
            <p role="alert" className="text-sm text-danger">
              {problem}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
