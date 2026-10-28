"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Check, Tray } from "@phosphor-icons/react";
import { SignedOutCard } from "@kriraghor/ui/account";
import { Badge, Button, ButtonLink, Card, EmptyState, Notice, Skeleton, useToast } from "@kriraghor/ui/kit";
import { DeskAccessNotice, deskAccessKey } from "@kriraghor/ui/desk";
import { problemOf } from "@kriraghor/api-client";
import { gymMe, type MyRequest } from "@/lib/gym-manage";
import { useFmt, useGymError } from "@/components/gym-manage/common";
import { useMyGyms } from "./MyHome";

/**
 * /me/requests (M24-FR-14, FR-15): gym invites to link my account. Each shows the gym, the name and
 * member code the gym typed, and exactly what the gym will see once I accept (name, phone, photo,
 * check-ins and payments at that gym, never anything else). **Accept** links; **Decline** leaves the
 * gym's record unlinked. My own join requests (M24-FR-16, prompt 3) sit apart: the gym, the package
 * and note I sent, and **Cancel** while the gym has not answered.
 */
export function MyRequests() {
  const t = useTranslations("gm");
  const tj = useTranslations("gp.join");
  const params = useSearchParams();
  const { status, requests } = useMyGyms();
  const err = useGymError();
  if (status === "signed_out") return <SignedOutCard signInHref="/sign-in?next=/me/requests" />;
  const all = requests.data?.items ?? [];
  const invites = all.filter((r) => r.direction !== "join_request");
  const joins = all.filter((r) => r.direction === "join_request");
  return (
    <section className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-6 md:py-10" data-testid="me-requests-page">
      <h1 className="font-display text-3xl font-extrabold">{t("me.requests")}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{t("me.requestsLead")}</p>
      {params.get("sent") ? (
        <Notice tone="success" className="mt-4">
          {tj("sentBody")}
        </Notice>
      ) : null}
      <div className="mt-6">
        {requests.isPending ? (
          <Skeleton className="h-40 rounded-card" />
        ) : requests.isError ? (
          <Notice tone="error">{err(requests.error)}</Notice>
        ) : !all.length ? (
          <EmptyState icon={<Tray size={32} aria-hidden />} title={t("me.noRequests")} />
        ) : (
          <div className="flex flex-col gap-8">
            {invites.length ? (
              <ul className="flex flex-col gap-3">
                {invites.map((r) => (
                  <li key={r.id}>
                    <RequestCard r={r} />
                  </li>
                ))}
              </ul>
            ) : null}
            {joins.length ? (
              <div data-testid="me-join-requests">
                <h2 className="font-display text-xl font-bold">{tj("mine")}</h2>
                <ul className="mt-3 flex flex-col gap-3">
                  {joins.map((r) => (
                    <li key={r.id}>
                      <JoinRequestCard r={r} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

/** One join request I sent: the gym, the package and note, its state; **Cancel** while it waits. */
function JoinRequestCard({ r }: { r: MyRequest }) {
  const t = useTranslations("gm");
  const tj = useTranslations("gp.join");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<unknown>(null);
  const cancel = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await gymMe.cancelRequest(r.id);
      toast.show(tj("cancelled"));
      await qc.invalidateQueries({ queryKey: ["my-gym-requests"] });
    } catch (e) {
      setProblem(e);
    } finally {
      setBusy(false);
    }
  };
  const tone = r.status === "pending" ? "warning" : r.status === "accepted" ? "brand" : "neutral";
  return (
    <Card className="flex flex-col gap-2" data-testid="me-join-request">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold">{r.gym?.name ?? t("me.gym")}</p>
          <p className="text-sm text-muted">
            {tj("sentOn", { date: f.short(r.createdAt) })}
            {r.status === "pending" ? ` · ${t("requests.expires", { date: f.short(r.expiresAt) })}` : ""}
          </p>
        </div>
        <Badge tone={tone}>{t(`requestStatus.${r.status}`)}</Badge>
      </div>
      {r.package ? <p className="text-sm">{tj("asked", { title: r.package.title })}</p> : null}
      {r.note ? <p className="whitespace-pre-line rounded-control bg-surface-2 p-3 text-sm">{r.note}</p> : null}
      {r.status === "declined" ? <p className="text-sm text-muted">{tj("declinedBody")}</p> : null}
      {problem ? <Notice tone="error">{err(problem)}</Notice> : null}
      {r.canCancel || r.memberId ? (
        <div className="flex flex-wrap gap-2">
          {r.canCancel ? (
            <Button type="button" variant="secondary" onClick={() => void cancel()} busy={busy} data-testid="me-join-cancel">
              {tj("cancel")}
            </Button>
          ) : null}
          {r.memberId ? (
            <ButtonLink href={`/me/memberships/${r.memberId}`} size="sm">
              {tj("openMembership")}
            </ButtonLink>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function RequestCard({ r }: { r: MyRequest }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [problem, setProblem] = useState<unknown>(null);
  const act = async (kind: "accept" | "decline") => {
    setBusy(kind);
    setProblem(null);
    try {
      if (kind === "accept") await gymMe.accept(r.id);
      else await gymMe.decline(r.id);
      toast.show(kind === "accept" ? t("me.accepted", { gym: r.gym?.name ?? "" }) : t("me.declined"));
      await qc.invalidateQueries({ queryKey: ["my-gym-requests"] });
      await qc.invalidateQueries({ queryKey: ["my-gym-memberships"] });
    } catch (e) {
      setProblem(e);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card className="flex flex-col gap-3" data-testid="me-request">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold">{r.gym?.name ?? t("me.gym")}</p>
          <p className="text-sm text-muted">
            {t("me.inviteFor", { name: r.displayName ?? "–", code: r.memberCode ?? "–" })} · {t("requests.expires", { date: f.short(r.expiresAt) })}
          </p>
        </div>
        <Badge tone={r.status === "pending" ? "warning" : "neutral"}>{t(`requestStatus.${r.status}`)}</Badge>
      </div>
      <div className="rounded-control bg-surface-2 p-3">
        <p className="text-sm font-semibold">{t("me.willSee")}</p>
        <ul className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
          {r.shares.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <Check size={14} className="text-brand-text" aria-hidden /> {t.has(`share.${s}`) ? t(`share.${s}`) : s}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">{t("me.neverSee")}</p>
      </div>
      {problem ? deskAccessKey(problemOf(problem)?.code) ? <DeskAccessNotice error={problem} /> : <Notice tone="error">{err(problem)}</Notice> : null}
      {r.status === "pending" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void act("accept")} busy={busy === "accept"} disabled={Boolean(busy)} data-testid="me-accept">
            {t("me.accept")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void act("decline")} busy={busy === "decline"} disabled={Boolean(busy)} data-testid="me-decline">
            {t("me.decline")}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
