"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { UserPlus } from "@phosphor-icons/react";
import { useAuth } from "@kriraghor/ui/auth";
import { SignedOutCard, useMe } from "@kriraghor/ui/account";
import { formatTaka } from "@kriraghor/ui/format";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { Button, ButtonLink, Notice, Skeleton, Textarea } from "@kriraghor/ui/kit";
import { gym, type GymPage } from "@/lib/gym";
import { gymMe } from "@/lib/gym-manage";
import { webHref } from "@/lib/links";
import { useGymError } from "@/components/gym-manage/common";

const NOTE_MAX = 300;

/** Where I stand with one gym: a member already, a join request waiting, or free to ask. */
function useJoinState(gymId: string | undefined) {
  const { status } = useAuth();
  const on = status === "signed_in" && Boolean(gymId);
  const requests = useQuery({ queryKey: ["my-gym-requests"], queryFn: () => gymMe.requests(), enabled: on });
  const memberships = useQuery({ queryKey: ["my-gym-memberships"], queryFn: () => gymMe.memberships(), enabled: on });
  const member = (memberships.data?.items ?? []).find((m) => m.gym?.id === gymId && m.linked && m.status !== "left" && m.status !== "removed");
  const pending = (requests.data?.items ?? []).find((r) => r.gym?.id === gymId && r.direction === "join_request" && r.status === "pending");
  return { status, member, pending, loading: on && (requests.isPending || memberships.isPending) };
}

/**
 * The gym page's **Join this gym** (M24-FR-16, §4.1): shown while the gym takes join requests
 * (joinRequestsOpen: live, managed on gym.kriraghor.com and switched on by the owner). A member of the
 * gym sees their membership instead; a request already sent shows "Request sent".
 */
export function JoinCta({ page }: { page: Pick<GymPage, "id" | "slug" | "joinRequestsOpen"> }) {
  const t = useTranslations("gp.join");
  const s = useJoinState(page.id);
  if (!page.joinRequestsOpen) return null;
  if (s.loading) return <Skeleton className="mt-4 h-12 w-full" />;
  if (s.member)
    return (
      <Notice tone="success" className="mt-4" action={<ButtonLink href={`/me/memberships/${s.member.memberId}`} size="sm" variant="secondary">{t("openMembership")}</ButtonLink>}>
        {t("alreadyMember")}
      </Notice>
    );
  if (s.pending)
    return (
      <div data-testid="join-pending">
        <Notice tone="info" className="mt-4" action={<ButtonLink href="/me/requests" size="sm" variant="secondary">{t("seeRequest")}</ButtonLink>}>
          {t("sent")}
        </Notice>
      </div>
    );
  return (
    <div className="mt-4 border-t-2 border-line pt-4">
      <p className="text-sm text-muted">{t("ctaLead")}</p>
      <ButtonLink href={`/gyms/${encodeURIComponent(page.slug)}/join`} size="lg" variant="secondary" block className="mt-2" icon={<UserPlus size={20} aria-hidden />} data-testid="join-gym">
        {t("cta")}
      </ButtonLink>
    </div>
  );
}

/**
 * /gyms/[slug]/join (M24-FR-16, FR-17): ask a gym to add me as a member. An optional package (one the
 * gym sells online), an optional note, and the consent line: the gym sees my name and phone (the full
 * phone once it accepts). It needs a verified phone (gate join_gym; gym members never need NID). The
 * request becomes a lead in the owner's Requests; when they accept, I am linked and see the membership.
 */
export function JoinForm({ slug }: { slug: string }) {
  const t = useTranslations("gp.join");
  const tg = useTranslations("gym");
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const err = useGymError();
  const { me } = useMe();
  const q = useQuery({ queryKey: ["gym", slug], queryFn: () => gym.page(slug), retry: false });
  const s = useJoinState(q.data?.id);
  const [packageId, setPackageId] = useState("");
  const [note, setNote] = useState("");
  const send = useMutation({
    mutationFn: () => gymMe.joinRequest({ gymId: q.data!.id, ...(packageId ? { packageId } : {}), ...(note.trim() ? { note: note.trim() } : {}) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-gym-requests"] });
      router.push("/me/requests?sent=1");
    },
  });

  const shell = (body: React.ReactNode) => (
    <div data-theme="gym" className="min-h-[70dvh]">
      <section className="mx-auto w-full max-w-[640px] px-4 py-8 sm:px-6" data-testid="join-page">
        <Link href={`/gyms/${encodeURIComponent(slug)}`} className="text-sm font-semibold text-brand underline">
          ← {q.data?.name ?? tg("back")}
        </Link>
        {body}
      </section>
    </div>
  );

  if (s.status === "signed_out") return shell(<SignedOutCard signInHref={`/sign-in?next=${encodeURIComponent(`/gyms/${slug}/join`)}`} />);
  if (q.isPending || s.loading || me.isPending) return shell(<Skeleton className="mt-6 h-80 w-full" />);
  if (q.isError || !q.data) return shell(<h1 className="mt-6 text-2xl font-extrabold">{tg("notFound")}</h1>);
  const g = q.data;
  if (!g.joinRequestsOpen) return shell(<Notice tone="info" className="mt-6">{t("closed")}</Notice>);
  if (s.member || s.pending) return shell(<JoinCta page={g} />);
  // M01 gate join_gym: a verified phone. Accounts made with Google or email add one on kriraghor.com.
  if (me.data && !me.data.phoneVerified)
    return shell(
      <Notice tone="warning" className="mt-6" title={t("phoneTitle")} action={<ButtonLink href={webHref("/account/settings")} size="sm">{t("phoneCta")}</ButtonLink>}>
        {t("phoneBody")}
      </Notice>,
    );

  const online = g.packages.filter((p) => (p.channel ?? "online") !== "desk");
  return shell(
    <form
      className="mt-4 flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        send.mutate();
      }}
    >
      <div>
        <h1 className="font-display text-3xl font-extrabold">{t("title", { gym: g.name })}</h1>
        <p className="mt-2 text-muted">{t("lead")}</p>
      </div>
      {online.length ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">
            {t("package")} <span className="font-normal text-muted">({t("optional")})</span>
          </legend>
          <label className={`rounded-control flex min-h-12 cursor-pointer items-center gap-3 border px-4 ${packageId === "" ? "border-brand" : "border-line"}`}>
            <input type="radio" name="package" value="" checked={packageId === ""} onChange={() => setPackageId("")} />
            <span>{t("noPackage")}</span>
          </label>
          {online.map((p) => (
            <label key={p.id} className={`rounded-control flex min-h-12 cursor-pointer items-center gap-3 border px-4 py-2 ${packageId === p.id ? "border-brand" : "border-line"}`} data-testid="join-package">
              <input type="radio" name="package" value={p.id} checked={packageId === p.id} onChange={() => setPackageId(p.id)} />
              <span className="flex-1">
                <span className="block font-bold">{p.title}</span>
                <span className="text-sm text-muted">{tg("forDays", { n: p.days })}</span>
              </span>
              <span className="font-extrabold tabular-nums">{formatTaka(p.price, locale)}</span>
            </label>
          ))}
          <p className="text-xs text-muted">{t("packageNote")}</p>
        </fieldset>
      ) : null}
      <Textarea
        id="join-note"
        label={t("note")}
        optional={t("optional")}
        hint={`${note.length}/${NOTE_MAX}`}
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
        rows={3}
        maxLength={NOTE_MAX}
        placeholder={t("notePlaceholder")}
        data-testid="join-note"
      />
      <Notice tone="info" title={t("consentTitle")}>
        {t("consent")}
      </Notice>
      {send.isError ? <Notice tone="error">{err(send.error)}</Notice> : null}
      <Button type="submit" size="lg" busy={send.isPending} data-testid="join-send">
        {t("send")}
      </Button>
    </form>,
  );
}
