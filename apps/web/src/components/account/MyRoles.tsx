"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ClipboardText, Storefront, UserGear } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { publicEnv } from "@kriraghor/session/env";
import { SignedOutCard, useMe } from "@kriraghor/ui/account";
import { Badge, Button, ButtonLink, Card, Dialog, EmptyState, ErrorState, Notice, PageTitle, Skeleton, SkeletonList, useToast, type Tone } from "@kriraghor/ui/kit";
import {
  canWithdrawRole,
  canWithdrawSubmission,
  errorKey,
  isSelfServiceRole,
  listSubmissions,
  roleNext,
  sortSubmissions,
  withdrawRole,
  withdrawSubmission,
  type MySubmission,
  type RoleNext,
  type RoleStatus,
  type UserRole,
} from "@/lib/account";
import type { BusinessRole } from "@/lib/kyc";

const ROLE_TONE: Record<RoleStatus, Tone> = {
  applied: "info",
  documents_pending: "warning",
  in_review: "info",
  changes_requested: "warning",
  active: "brand",
  rejected: "danger",
  suspended: "danger",
  withdrawn: "neutral",
};
const SUB_TONE: Record<MySubmission["status"], Tone> = {
  pending_review: "info",
  changes_requested: "warning",
  approved: "brand",
  rejected: "danger",
  withdrawn: "neutral",
  superseded: "neutral",
};

type Confirm = { kind: "role"; role: BusinessRole } | { kind: "submission"; id: string; title: string } | null;

/** "DOCS_UNCLEAR" → "Docs unclear": a readable fallback for reason codes. */
const humanise = (code: string) => {
  const s = code.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * /account/roles (M01 roles, M05 submissions): every role the member applied for, where it stands and
 * what to do next, with withdraw while it is still open; and the listings and applications they sent
 * for review, with the decision and reason.
 */
export function MyRoles() {
  const t = useTranslations("myRoles");
  const te = useTranslations("accountSettings.errors");
  const tg = useTranslations("errors");
  const locale = useLocale();
  const toast = useToast();
  const qc = useQueryClient();
  const { status, me } = useMe();
  const subs = useQuery({ queryKey: ["my-submissions"], enabled: status === "signed_in", queryFn: listSubmissions });
  const [confirm, setConfirm] = useState<Confirm>(null);
  const date = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" });
  const fmt = (iso: string | null) => (iso ? date.format(new Date(iso)) : null);

  const withdraw = useMutation({
    mutationFn: async (c: NonNullable<Confirm>) => {
      if (c.kind === "role") await withdrawRole(c.role);
      else await withdrawSubmission(c.id);
    },
    onSuccess: async (_r, c) => {
      setConfirm(null);
      await Promise.all([qc.invalidateQueries({ queryKey: ["me"] }), qc.invalidateQueries({ queryKey: ["my-submissions"] })]);
      toast.show(c.kind === "role" ? t("roleWithdrawn") : t("submissionWithdrawn"));
    },
  });
  const problem = problemOf(withdraw.error);
  const problemText = withdraw.error ? (errorKey(problem?.code) ? te(errorKey(problem?.code)!) : (problem?.title ?? tg("generic"))) : null;

  if (status === "signed_out") return <SignedOutCard signInHref="/sign-in?next=/account/roles" />;

  const roles = (me.data?.roles ?? []).filter((r): r is UserRole & { role: BusinessRole } => isSelfServiceRole(r.role));
  const kycVerified = me.data?.kycStatus === "verified";

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 md:px-0 md:py-8" data-testid="my-roles">
      <PageTitle
        title={t("title")}
        description={t("lead")}
        actions={
          <ButtonLink href="/account/business" variant="secondary" icon={<Storefront size={18} aria-hidden />}>
            {t("applyNew")}
          </ButtonLink>
        }
      />

      <Card className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <UserGear size={22} aria-hidden className="text-brand-text" />
          {t("rolesTitle")}
        </h2>
        {me.isError ? (
          <ErrorState onRetry={() => void me.refetch()} />
        ) : !me.data ? (
          <Skeleton className="h-32 rounded-card" />
        ) : roles.length === 0 ? (
          <EmptyState
            icon={<UserGear />}
            title={t("noRoles")}
            body={t("noRolesBody")}
            action={<ButtonLink href="/account/business">{t("applyNew")}</ButtonLink>}
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {roles.map((r) => (
              <RoleItem key={r.role} item={r} next={roleNext(r.role, r.status, kycVerified)} fmt={fmt} onWithdraw={() => setConfirm({ kind: "role", role: r.role })} />
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <ClipboardText size={22} aria-hidden className="text-brand-text" />
            {t("submissionsTitle")}
          </h2>
          <p className="mt-0.5 text-sm text-muted">{t("submissionsLead")}</p>
        </div>
        {subs.isPending ? (
          <SkeletonList rows={2} label={t("loading")} />
        ) : subs.isError ? (
          <ErrorState onRetry={() => void subs.refetch()} />
        ) : subs.data.length === 0 ? (
          <p className="text-sm text-muted">{t("noSubmissions")}</p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="my-submissions">
            {sortSubmissions(subs.data).map((s) => (
              <li key={s.id} className="flex flex-col gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0" data-testid="my-submission">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 font-semibold">
                    <span className="break-words">{s.title}</span>
                    <span className="ml-2 text-sm font-normal text-muted">{t.has(`kind.${s.kind}`) ? t(`kind.${s.kind}`) : humanise(s.kind)}</span>
                  </p>
                  <Badge tone={SUB_TONE[s.status]}>{t(`subStatus.${s.status}`)}</Badge>
                </div>
                <p className="text-sm text-muted">
                  {t("sentOn", { date: fmt(s.submittedAt) ?? "" })}
                  {s.decidedAt ? ` · ${t("decidedOn", { date: fmt(s.decidedAt) ?? "" })}` : ""}
                </p>
                {s.reasonText || s.reasonCode ? <p className="text-sm text-danger">{t("reason", { reason: s.reasonText ?? humanise(s.reasonCode ?? "") })}</p> : null}
                {canWithdrawSubmission(s) ? (
                  <div>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setConfirm({ kind: "submission", id: s.id, title: s.title })} data-testid="submission-withdraw">
                      {t("withdraw")}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog
        open={confirm !== null}
        onOpenChange={(o) => {
          if (!o) {
            setConfirm(null);
            withdraw.reset();
          }
        }}
        title={confirm?.kind === "role" ? t("confirmRoleTitle", { role: t(`roleName.${confirm.role}`) }) : t("confirmSubmissionTitle")}
        description={confirm?.kind === "role" ? t("confirmRoleBody") : t("confirmSubmissionBody", { title: confirm?.kind === "submission" ? confirm.title : "" })}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setConfirm(null)}>
              {t("keep")}
            </Button>
            <Button type="button" variant="danger" busy={withdraw.isPending} onClick={() => confirm && withdraw.mutate(confirm)} data-testid="withdraw-confirm">
              {t("withdraw")}
            </Button>
          </>
        }
      >
        {problemText ? <Notice tone="error">{problemText}</Notice> : null}
      </Dialog>
    </section>
  );
}

function RoleItem({ item, next, fmt, onWithdraw }: { item: UserRole & { role: BusinessRole }; next: RoleNext; fmt: (iso: string | null) => string | null; onWithdraw: () => void }) {
  const t = useTranslations("myRoles");
  const ta = useTranslations("account");
  const vendorUrl = `${publicEnv().VENDOR_URL}/vendor`;
  const action =
    next.kind === "openVendorDesk" ? (
      <ButtonLink href={vendorUrl} size="sm" iconEnd={<ArrowRight size={16} aria-hidden />}>
        {t("next.openVendorDesk")}
      </ButtonLink>
    ) : "href" in next ? (
      <ButtonLink href={next.href} size="sm" variant={next.kind === "openProDesk" ? "primary" : "secondary"} iconEnd={<ArrowRight size={16} aria-hidden />}>
        {t(`next.${next.kind}`)}
      </ButtonLink>
    ) : next.kind === "contact" ? (
      <ButtonLink href="/help" size="sm" variant="secondary">
        {t("next.contact")}
      </ButtonLink>
    ) : null;

  return (
    <li className="flex flex-col gap-2 border-t border-line pt-4 first:border-t-0 first:pt-0" data-testid={`role-${item.role}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-lg font-semibold">{t(`roleName.${item.role}`)}</p>
        <Badge tone={ROLE_TONE[item.status]}>{ta(`roleStatus.${item.status}`)}</Badge>
      </div>
      <p className="text-sm text-muted">
        {item.activatedAt && item.status === "active" ? t("activeSince", { date: fmt(item.activatedAt) ?? "" }) : item.appliedAt ? t("appliedOn", { date: fmt(item.appliedAt) ?? "" }) : null}
      </p>
      <p className="text-sm">{t(`hint.${next.kind}`)}</p>
      {item.reasonCode && ["changes_requested", "rejected", "suspended"].includes(item.status) ? <p className="text-sm text-danger">{t("reason", { reason: humanise(item.reasonCode) })}</p> : null}
      <div className="flex flex-wrap gap-2">
        {action}
        {canWithdrawRole(item.status) ? (
          <Button type="button" variant="ghost" size="sm" onClick={onWithdraw} data-testid={`withdraw-${item.role}`}>
            {t("withdrawApplication")}
          </Button>
        ) : null}
      </div>
    </li>
  );
}
