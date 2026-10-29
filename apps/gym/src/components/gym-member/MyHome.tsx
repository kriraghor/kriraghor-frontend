"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Barbell, CaretRight, CreditCard, QrCode, Tray } from "@phosphor-icons/react";
import { useAuth } from "@kriraghor/ui/auth";
import { SignedOutCard } from "@kriraghor/ui/account";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Badge, ButtonLink, Card, EmptyState, Notice, Skeleton } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { gymMe, type MyMembershipCard } from "@/lib/gym-manage";
import { MemberStatus, useFmt, useGymError } from "@/components/gym-manage/common";
import { TodayPlans } from "./MyPlans";

/** My gym requests and memberships, shared by /me and its pieces. */
export function useMyGyms() {
  const { status } = useAuth();
  const on = status === "signed_in";
  const requests = useQuery({ queryKey: ["my-gym-requests"], queryFn: () => gymMe.requests(), enabled: on });
  const memberships = useQuery({ queryKey: ["my-gym-memberships"], queryFn: () => gymMe.memberships(), enabled: on });
  // Waiting for my answer: gym invites (my own join requests wait for the gym).
  return { status, requests, memberships, pending: (requests.data?.items ?? []).filter((r) => r.status === "pending" && r.direction === "gym_invite").length };
}

/**
 * /me (M24 §4.1 member area): requests waiting (a badge), each gym I belong to (package, days left,
 * what is outstanding with **Pay** when the gym takes fees online, M24 prompt 2), today's workout and meals
 * (prompt 3) and **My check-in QR**. No gyms → find one. Past gyms (unlinked) sit apart.
 */
export function MyHome() {
  const t = useTranslations("gm");
  const { status, memberships, pending } = useMyGyms();
  if (status === "signed_out") return <SignedOutCard signInHref="/sign-in?next=/me" />;
  const items = memberships.data?.items ?? [];
  const current = items.filter((m) => m.linked);
  return (
    <section className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-6 md:py-10" data-testid="me-home">
      <h1 className="font-display text-3xl font-extrabold">{t("me.title")}</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {current.length ? (
          <ButtonLink href="/me/checkin" size="lg" icon={<QrCode size={20} aria-hidden />} data-testid="me-checkin">
            {t("me.checkinQr")}
          </ButtonLink>
        ) : null}
        <ButtonLink href="/me/requests" variant="secondary" size="lg" icon={<Tray size={20} aria-hidden />} data-testid="me-requests">
          {t("me.requests")} {pending ? <Badge tone="danger">{pending}</Badge> : null}
        </ButtonLink>
      </div>
      {pending ? (
        <Notice tone="info" className="mt-4" action={<ButtonLink href="/me/requests" size="sm">{t("me.review")}</ButtonLink>}>
          {t("me.pending", { n: pending })}
        </Notice>
      ) : null}
      <TodayPlans />
      <div className="mt-6">
        <MembershipCards items={items} loading={memberships.isPending} error={memberships.error} />
      </div>
    </section>
  );
}

/** /me/memberships: every gym I belong to, current and past. */
export function MyMemberships() {
  const t = useTranslations("gm");
  const { status, memberships } = useMyGyms();
  if (status === "signed_out") return <SignedOutCard signInHref="/sign-in?next=/me/memberships" />;
  return (
    <section className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-6 md:py-10">
      <h1 className="font-display text-3xl font-extrabold">{t("me.memberships")}</h1>
      <div className="mt-6">
        <MembershipCards items={memberships.data?.items ?? []} loading={memberships.isPending} error={memberships.error} />
      </div>
    </section>
  );
}

function MembershipCards({ items, loading, error }: { items: MyMembershipCard[]; loading: boolean; error: unknown }) {
  const t = useTranslations("gm");
  const err = useGymError();
  if (loading) return <Skeleton className="h-40 rounded-card" />;
  if (error) return <Notice tone="error">{err(error)}</Notice>;
  if (!items.length) return <EmptyState icon={<Barbell size={32} aria-hidden />} title={t("me.noGyms")} body={t("me.noGymsBody")} action={<ButtonLink href="/gyms">{t("me.findGym")}</ButtonLink>} />;
  const current = items.filter((m) => m.linked);
  const past = items.filter((m) => !m.linked);
  return (
    <div className="flex flex-col gap-6">
      {current.length ? (
        <ul className="grid gap-3 md:grid-cols-2" data-testid="me-gyms">
          {current.map((m) => (
            <li key={m.memberId}>
              <GymCard m={m} />
            </li>
          ))}
        </ul>
      ) : null}
      {past.length ? (
        <div>
          <h2 className="font-display text-lg font-bold">{t("me.past")}</h2>
          <ul className="mt-2 grid gap-3 md:grid-cols-2">
            {past.map((m) => (
              <li key={m.memberId}>
                <GymCard m={m} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function GymCard({ m }: { m: MyMembershipCard }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const href = `/me/memberships/${m.memberId}`;
  return (
    <div data-testid="me-gym">
      <Card className={cn("flex flex-col gap-2", !m.linked && "opacity-80")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={href} className="block truncate font-display text-lg font-bold hover:underline">
              {m.gym?.name ?? t("me.gym")}
            </Link>
            <p className="text-xs text-muted tabular-nums">{m.memberCode}</p>
          </div>
          <MemberStatus status={m.status} />
        </div>
        {m.current ? (
          <div>
            <p className="font-semibold">{m.current.title}</p>
            <p className="text-sm text-muted">
              {t("me.until", { date: f.date(m.current.endsOn) })} · {m.current.frozen ? t("flag.frozen") : t("ms.daysLeft", { n: m.current.daysLeft })}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">{t("me.noPackage")}</p>
        )}
        {m.outstandingPoisha > 0 ? (
          <p className="text-sm font-semibold text-warning" data-testid="me-outstanding">
            {t("me.outstanding", { amount: f.taka(m.outstandingPoisha) })}
            {m.onlineFees && m.linked ? null : ` · ${t("me.payCounter")}`}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <Link href={href} className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-brand-text">
            {t("me.open")} <CaretRight size={14} aria-hidden />
          </Link>
          {m.outstandingPoisha > 0 && m.onlineFees && m.linked ? (
            <ButtonLink href="/me/dues" size="sm" icon={<CreditCard size={16} aria-hidden />} data-testid="me-gym-pay">
              {t("me.pay")}
            </ButtonLink>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
