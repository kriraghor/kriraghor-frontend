"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { teams } from "@/lib/teams";
import { Button, Notice } from "@kriraghor/ui/primitives";

/**
 * /teams/join/[token] (M16 §16): the share link a captain sent. It shows the team, the sport, the
 * inviter's first name and the masked number. The invite belongs to whoever verifies that number, so
 * the visitor signs in (or signs up) with it and accepts here.
 */
export function JoinInvite({ token }: { token: string }) {
  const t = useTranslations("teams");
  const locale = useLocale();
  const { status } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const q = useQuery({ queryKey: ["team-invite-link", token], queryFn: () => teams.link(token), retry: false });
  const accept = useMutation({
    mutationFn: () => teams.accept(q.data!.id),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["my-teams"] });
      qc.invalidateQueries({ queryKey: ["my-team-invites"] });
      router.push(`/me/teams/${r.teamId}`);
    },
  });

  if (q.isPending) return <div className="mx-auto mt-10 h-72 max-w-[560px] animate-pulse bg-surface-2" />;
  if (q.isError || !q.data)
    return (
      <section className="mx-auto max-w-[560px] px-5 py-16">
        <h1 className="text-2xl font-extrabold">{t("linkGone")}</h1>
        <p className="mt-2 text-muted">{t("linkGoneHint")}</p>
      </section>
    );

  const inv = q.data;
  const open = inv.status === "pending" && !inv.expired && inv.team?.status === "active";
  const p = problemOf(accept.error);
  const err = p ? (t.has(`errors.${p.code}`) ? t(`errors.${p.code}`) : (p.title ?? t("failed"))) : null;
  const sport = inv.team?.sport ? (locale === "bn" ? inv.team.sport.nameBn : inv.team.sport.nameEn) : "–";

  return (
    <section className="mx-auto max-w-[560px] px-5 py-12" data-testid="join-invite">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("teamInvite")}</p>
      <h1 className="mt-1 text-3xl font-extrabold" data-testid="join-team">
        {inv.team?.name ?? "–"}
      </h1>
      <p className="mt-1 text-muted">
        {sport} · {t("invitedBy", { name: inv.invitedBy ?? "–" })}
      </p>
      <p className="mt-4 border-l-4 border-brand pl-3">{t("sentTo", { phone: inv.phoneMasked })}</p>

      {!open ? (
        <div className="mt-6">
          <Notice tone="error">{inv.expired || inv.status === "expired" ? t("errors.INVITE_EXPIRED") : t("linkClosed")}</Notice>
        </div>
      ) : status === "signed_in" ? (
        <div className="mt-6 flex flex-col gap-3">
          {err ? <Notice tone="error">{err}</Notice> : null}
          <Button type="button" busy={accept.isPending} onClick={() => accept.mutate()} data-testid="join-accept">
            {t("joinTeam")}
          </Button>
          {p?.code === "INVITE_NOT_YOURS" || p?.code === "PHONE_REQUIRED" ? (
            <Link href="/me/eligibility#phone" className="font-semibold text-brand underline">
              {t("addPhone")}
            </Link>
          ) : null}
        </div>
      ) : status === "signed_out" ? (
        <div className="mt-6 flex flex-col gap-2">
          <p>{t("signInWith", { phone: inv.phoneMasked })}</p>
          <Link href={`/sign-in?next=${encodeURIComponent(`/teams/join/${token}`)}`} className="inline-flex min-h-12 items-center justify-center bg-brand px-5 font-bold text-white" data-testid="join-sign-in">
            {t("signInToJoin")}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
