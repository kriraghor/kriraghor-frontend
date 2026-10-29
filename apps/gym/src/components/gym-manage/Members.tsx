"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CaretRight, UploadSimple, UserPlus, UsersThree } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Avatar, Badge, Button, ButtonLink, EmptyState, FilterBar, Notice, SkeletonList } from "@kriraghor/ui/kit";
import { useUrlFilters } from "@kriraghor/ui/url-filters";
import { featureLocked, gymManage, MEMBER_VIEWS, membersQuery, type MemberRow } from "@/lib/gym-manage";
import { GymPage, MemberStatus, useFmt, useGymError, useDeskPackages, type GymCtx } from "./common";

const SPEC = { view: { default: "", allowed: MEMBER_VIEWS }, q: { default: "" }, packageId: { default: "" }, trainerId: { default: "" } };

/**
 * /manage/[gymId]/members (M24-FR-23): the member list with the views in the URL (active, due, overdue,
 * expiring in 7 days, frozen, expired, left, not seen, not linked), search by name, member code or
 * phone, a package filter (owner), a trainer filter (feature trainers, M24-FR-21), cursor pages,
 * **Add member** and **Import**.
 */
export function Members({ gymId }: { gymId: string }) {
  const t = useTranslations("gm");
  return (
    <GymPage
      gymId={gymId}
      page="members"
      title={t("members.title")}
      testId="gm-members"
      actions={(ctx) => <Actions ctx={ctx} />}
    >
      {(ctx) => <List ctx={ctx} />}
    </GymPage>
  );
}

function Actions({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gm");
  const gymId = ctx.gymId;
  return (
    <>
      {ctx.can("members.edit") ? (
      <ButtonLink href={`/manage/${gymId}/members/new`} icon={<UserPlus size={18} aria-hidden />} data-testid="members-add">
        {t("members.add")}
      </ButtonLink>
      ) : null}
      {ctx.owner ? (
      <ButtonLink href={`/manage/${gymId}/import`} variant="secondary" icon={<UploadSimple size={18} aria-hidden />} data-testid="members-import">
        {t("nav.import")}
      </ButtonLink>
      ) : null}
    </>
  );
}

function List({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gm");
  const err = useGymError();
  const { gymId } = ctx;
  const { values, set, clear } = useUrlFilters(SPEC);
  const packages = useDeskPackages(gymId, ctx.owner || ctx.can("members.view"));
  const trainers = useTrainers(ctx, ctx.can("members.view"));
  const q = useInfiniteQuery({
    queryKey: ["gm-members", gymId, values.view, values.q, values.packageId, values.trainerId],
    queryFn: ({ pageParam }) =>
      gymManage.members(gymId, membersQuery({ view: values.view, q: values.q, packageId: values.packageId, trainerId: values.trainerId, cursor: pageParam || undefined, limit: 25 })),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        search={{ value: values.q, onChange: (v) => set({ q: v }), label: t("members.search"), placeholder: t("members.searchHint"), testId: "members-search" }}
        chips={{ value: values.view, onChange: (v) => set({ view: v }), label: t("members.views"), options: MEMBER_VIEWS.map((v) => ({ value: v, label: t(`members.view.${v || "all"}`) })), testId: "members-views" }}
        selects={[
          ...(packages.all.length ? [{ id: "package", label: t("members.package"), value: values.packageId, onChange: (v: string) => set({ packageId: v }), anyLabel: t("members.anyPackage"), options: packages.all.map((p) => ({ value: p.id, label: p.title })) }] : []),
          ...(trainers.length ? [{ id: "trainer", label: t("members.trainer"), value: values.trainerId, onChange: (v: string) => set({ trainerId: v }), anyLabel: t("members.anyTrainer"), options: trainers.map((tr) => ({ value: tr.businessMemberId, label: tr.displayName ?? t("members.trainerNoName") })) }] : []),
        ]}
        onClear={clear}
      />
      {q.isPending ? (
        <SkeletonList rows={6} />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : !rows.length ? (
        values.view || values.q || values.packageId || values.trainerId ? (
          <EmptyState title={t("members.noneMatch")} action={<Button type="button" variant="secondary" onClick={clear}>{t("members.clear")}</Button>} />
        ) : (
          <EmptyState icon={<UsersThree size={32} aria-hidden />} title={t("members.empty")} body={t("members.emptyBody")} action={<Actions ctx={ctx} />} />
        )
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface" data-testid="members-list">
          {rows.map((m) => (
            <li key={m.id}>
              <MemberLine gymId={gymId} m={m} />
            </li>
          ))}
        </ul>
      )}
      {q.hasNextPage ? (
        <Button type="button" variant="secondary" onClick={() => void q.fetchNextPage()} busy={q.isFetchingNextPage} className="self-center" data-testid="members-more">
          {t("loadMore")}
        </Button>
      ) : null}
    </div>
  );
}

function MemberLine({ gymId, m }: { gymId: string; m: MemberRow }) {
  const t = useTranslations("gm");
  const f = useFmt();
  return (
    <Link href={`/manage/${gymId}/members/${m.id}`} className="flex items-center gap-3 px-3 py-2.5 no-underline hover:bg-surface-2" data-testid="member-row">
      <Avatar name={m.displayName} size={40} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate font-semibold">{m.displayName}</span>
          <span className="text-xs text-muted tabular-nums">
            {m.memberCode} · ••{m.phoneLast4}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-sm text-muted">
          {m.current ? t("members.current", { title: m.current.title, end: f.short(m.current.endsOn), days: m.current.daysLeft }) : t("members.noPackage")}
        </span>
        <span className="mt-1 flex flex-wrap gap-1">
          <MemberStatus status={m.status} />
          {m.flags.overdue ? <Badge tone="danger">{t("flag.overdue")}</Badge> : m.flags.due ? <Badge tone="warning">{t("flag.due")}</Badge> : null}
          {m.current?.status === "frozen" ? <Badge tone="info">{t("flag.frozen")}</Badge> : null}
          {!m.linked ? <Badge>{t("flag.unlinked")}</Badge> : null}
          {m.trainer ? <Badge tone="info">{t("members.withTrainer", { name: m.trainer.displayName ?? t("members.trainerNoName") })}</Badge> : null}
        </span>
      </span>
      <span className="hidden shrink-0 text-right text-xs text-muted sm:block">
        {m.outstandingPoisha ? <span className="block text-sm font-semibold text-ink">{f.taka(m.outstandingPoisha)}</span> : null}
        {m.lastCheckInOn ? t("members.lastSeen", { date: f.short(m.lastCheckInOn) }) : t("members.neverSeen")}
      </span>
      <CaretRight size={16} aria-hidden className="shrink-0 text-muted" />
    </Link>
  );
}

/** The gym's trainers (staff with members.trainer or plans.manage) when the plan has the trainers feature (M24-FR-21). */
export function useTrainers(ctx: GymCtx, enabled: boolean) {
  const on = enabled && !featureLocked(ctx.gym.features, "trainers");
  const q = useQuery({ queryKey: ["gm-trainers", ctx.gymId], queryFn: () => gymManage.trainers(ctx.gymId), enabled: on, staleTime: 60_000 });
  return on ? (q.data?.items ?? []) : [];
}
