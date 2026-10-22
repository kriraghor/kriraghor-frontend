"use client";

import { Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Paperclip, Star } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { Button, DataTable, DetailLayout, FilterBar, Notice, PageTitle, Skeleton, Textarea, buttonClass, cn, useToast, type Column } from "@kriraghor/ui/kit";
import { formatTaka } from "@/lib/admin/finance";
import { businessView } from "@/lib/panel-nav";
import { vendor } from "@/lib/vendor/grounds";
import { gymDesk } from "@/lib/vendor/gym";
import { shopDesk } from "@/lib/vendor/market";
import { EVIDENCE_TYPES, ownerTrust, replyErrorKey, replyOk, replyState, reviewSubjectsFor, subjectName, type BusinessSubject, type Review } from "@/lib/vendor/trust";
import { useCursorList } from "@/lib/use-cursor-list";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../StatusBadge";
import { formatDhaka } from "../admin/useAdminMe";
import { useWorkplaces } from "./StaffAccess";

type CaseRow = Awaited<ReturnType<typeof ownerTrust.cases>>["items"][number];

/**
 * /vendor/disputes (M17 FR-06): cases members opened about the owner's bookings. A case waits for the
 * owner's side (disputes.respondent_hours), then our team decides; while it is open the money stays
 * in escrow. /vendor/disputes/[code] opens one.
 */
export function OwnerDisputes({ initial }: { initial?: string }) {
  // The open case lives in the URL (?id=, useSearchParams), so the desk renders inside Suspense.
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-64 max-w-[1320px]" />}>
      <Disputes initial={initial} />
    </Suspense>
  );
}

function Disputes({ initial }: { initial?: string }) {
  const t = useTranslations("vendorTrust");
  const locale = useLocale();
  const { set, params } = useUrlFilters({});
  const [dismissed, setDismissed] = useState(false);
  const open = params.get("id") ?? (dismissed ? null : (initial ?? null));
  const list = useCursorList<CaseRow>(["owner-disputes"], (cursor) => ownerTrust.cases(cursor));

  const columns: Column<CaseRow>[] = [
    {
      id: "case",
      header: t("col.case"),
      primary: true,
      sort: (d) => d.category,
      cell: (d) => (
        <>
          <span className="block font-semibold">{t(`category.${d.category}`)}</span>
          <span className="block font-mono text-xs font-normal text-muted">
            {d.code} · {d.sourceRef}
          </span>
        </>
      ),
    },
    {
      id: "status",
      header: t("col.status"),
      sort: (d) => d.status,
      cell: (d) => (
        <StatusBadge status={d.status} domain="ownerDispute">
          {t(`status.${d.status}`)}
        </StatusBadge>
      ),
    },
    { id: "opened", header: t("col.opened"), hideBelow: "lg", sort: (d) => String(d.createdAt), cell: (d) => <span className="whitespace-nowrap text-muted">{formatDhaka(String(d.createdAt), locale)}</span> },
  ];

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
      <PageTitle title={t("disputesTitle")} description={t("disputesIntro")} />
      <DetailLayout
        className="mt-6"
        open={Boolean(open)}
        onClose={() => {
          setDismissed(true);
          set({ id: null });
        }}
        title={<span className="font-mono">{open}</span>}
        pane={open ? <OwnerCase key={open} code={open} /> : null}
        width={520}
        testId="owner-case"
      >
        <DataTable
          label={t("disputesTitle")}
          testId="owner-disputes"
          columns={columns}
          rows={list.rows}
          rowId={(d) => d.code}
          loading={list.loading}
          error={list.error}
          onRetry={list.retry}
          empty={{ title: t("noDisputes") }}
          hasMore={list.hasMore}
          onMore={list.more}
          busy={list.busy}
          onRowClick={(d) => set({ id: d.code })}
          selectedId={open}
        />
      </DetailLayout>
    </div>
  );
}

function OwnerCase({ code }: { code: string }) {
  const t = useTranslations("vendorTrust");
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["owner-dispute", code], queryFn: () => ownerTrust.get(code) });
  const [text, setText] = useState("");
  const [fileErr, setFileErr] = useState<string | null>(null);
  const refresh = () => (qc.invalidateQueries({ queryKey: ["owner-dispute", code] }), qc.invalidateQueries({ queryKey: ["owner-disputes"] }));
  const say = useMutation({ mutationFn: () => (q.data?.can.respond ? ownerTrust.respond(code, text.trim()) : ownerTrust.statement(code, text.trim())), onSuccess: () => (setText(""), refresh()) });
  const upload = useMutation({ mutationFn: (f: File) => ownerTrust.upload(code, f), onSuccess: refresh });
  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const { dispute: d, evidence, can, source } = q.data;
  const src = (source ?? {}) as Record<string, unknown>;
  const problem = problemOf(say.error) ?? problemOf(upload.error);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={d.status} domain="ownerDispute">
          <span data-testid="owner-case-status">{t(`status.${d.status}`)}</span>
        </StatusBadge>
      </div>
      <div>
        <p className="font-display text-lg font-bold">{t(`category.${d.category}`)}</p>
        <p className="text-sm text-muted">
          {String(src.groundName ?? src.shopName ?? "")} {src.start ? `· ${formatDhaka(String(src.start), locale)}` : ""} · {d.sourceRef}
        </p>
        <p className="mt-2 text-sm">{d.money ? t("heldLine", { amount: formatTaka(d.held, locale) }) : t("findingsLine")}</p>
      </div>
      {d.status === "awaiting_response" && d.respondentDueAt ? <Notice tone="error">{t("answerBy", { when: formatDhaka(String(d.respondentDueAt), locale) })}</Notice> : null}
      {d.status === "resolved" ? <Notice tone="success">{t("decided", { outcome: t(`outcome.${d.outcome}`), refund: formatTaka(d.refund ?? 0, locale) })}</Notice> : null}
      <ol className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {evidence.map((e) => (
          <li key={e.id} className={cn("rounded-control border-l-4 bg-surface-2/60 py-2 pl-3 pr-2 text-sm", e.party === "respondent" ? "border-brand" : "border-line-strong/50")}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t(`party.${e.party}`)} · {formatDhaka(e.createdAt, locale)}
            </p>
            {e.text ? <p className="whitespace-pre-line">{e.text}</p> : null}
            {e.file ? (
              <Button type="button" variant="link" onClick={() => ownerTrust.openFile(code, e.id)}>
                {t("openFile")}
              </Button>
            ) : null}
          </li>
        ))}
      </ol>
      {can.addEvidence ? (
        <form
          className="flex flex-col gap-3 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            say.mutate();
          }}
        >
          <Textarea id="owner-side" label={can.respond ? t("yourSide") : t("addMore")} value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={text.trim().length < 2} busy={say.isPending} data-testid="owner-respond">
              {can.respond ? t("sendSide") : t("send")}
            </Button>
            <label className={cn(buttonClass({ variant: "secondary" }), "cursor-pointer", !can.filesLeft && "pointer-events-none opacity-50")}>
              <Paperclip size={18} aria-hidden />
              {upload.isPending ? t("uploading") : t("addFile", { left: can.filesLeft })}
              <input
                type="file"
                className="sr-only"
                accept={EVIDENCE_TYPES.join(",")}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (!EVIDENCE_TYPES.includes(f.type)) return setFileErr(t("fileType"));
                  setFileErr(null);
                  upload.mutate(f);
                }}
              />
            </label>
          </div>
          {fileErr ? <Notice tone="error">{fileErr}</Notice> : null}
          {problem ? <Notice tone="error">{problem.title}</Notice> : null}
        </form>
      ) : null}
    </div>
  );
}

/** Stars as icons: filled for the rating, outlined for the rest. */
function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${n}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={16} weight={i <= n ? "fill" : "regular"} aria-hidden className={i <= n ? "text-prize" : "text-muted"} />
      ))}
    </span>
  );
}

type ReviewRow = Review & { subjectName?: string | null };
const KINDS = ["ground", "shop", "gym"] as const;

/**
 * /vendor/reviews (M17 FR-25, FR-34; Round B1): members' ratings of everything the owner runs (venues,
 * shops and gyms), newest first, filtered by kind and by place, with one reply each (editable) written
 * in the side pane. The kinds offered follow the business roles held.
 */
export function OwnerReviews() {
  // The filters and the open review live in the URL (useSearchParams), so the desk renders inside Suspense.
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-64 max-w-[1320px]" />}>
      <Reviews />
    </Suspense>
  );
}

function Reviews() {
  const t = useTranslations("vendorTrust");
  const locale = useLocale();
  const me = useQuery({ queryKey: ["vendor-me"], queryFn: () => vendor.me() });
  const owned = reviewSubjectsFor(businessView(me.data).active);
  // Round B3 (Q170): venue staff with the optional reviews.reply permission answer that venue's reviews.
  const wp = useWorkplaces();
  const staffVenues = wp.named.filter((w) => w.businessType === "venue" && w.permissions.includes("reviews.reply"));
  const kinds = staffVenues.length && !owned.includes("ground") ? (["ground", ...owned] as BusinessSubject[]) : owned;
  const { values, set, clear, params } = useUrlFilters({ type: { default: "", allowed: ["", ...KINDS] }, place: { default: "" } });
  const grounds = useQuery({ queryKey: ["vendor-grounds"], queryFn: () => vendor.mine(), enabled: owned.includes("ground"), retry: false });
  const shop = useQuery({ queryKey: ["vendor-shop"], queryFn: () => shopDesk.profile(), enabled: kinds.includes("shop"), retry: false });
  const gyms = useQuery({ queryKey: ["vendor-gyms"], queryFn: () => gymDesk.mine(), enabled: kinds.includes("gym"), retry: false });
  const places: { id: string; name: string; type: BusinessSubject }[] = [
    ...(grounds.data?.items ?? []).map((g) => ({ id: g.id, name: g.name, type: "ground" as const })),
    ...(shop.data ? [{ id: shop.data.id, name: shop.data.name, type: "shop" as const }] : []),
    ...(gyms.data?.items ?? []).map((g) => ({ id: g.id, name: g.name, type: "gym" as const })),
    ...staffVenues.filter((w) => !(grounds.data?.items ?? []).some((g) => g.id === w.businessId)).map((w) => ({ id: w.businessId, name: w.business.name ?? "–", type: "ground" as const })),
  ];
  const names = new Map(places.map((p) => [p.id, p.name] as const));
  const type = (values.type || undefined) as BusinessSubject | undefined;
  const choosable = places.filter((p) => !type || p.type === type);
  // Someone who owns nothing reviewable sees the reviews of a venue they work at (the API needs it named).
  const place = choosable.find((p) => p.id === values.place)?.id ?? (!owned.length ? choosable[0]?.id : undefined);
  const list = useCursorList<ReviewRow>(["owner-reviews", type ?? "", place ?? ""], (cursor) => ownerTrust.reviews({ subjectType: type, subjectId: place, cursor }), { enabled: !wp.pending });
  const open = params.get("id");
  const picked = open ? list.items.find((r) => r.id === open) : undefined;
  const kindLabel = (s: string) => (t.has(`subject.${s}`) ? t(`subject.${s}`) : s);

  const columns: Column<ReviewRow>[] = [
    {
      id: "review",
      header: t("col.review"),
      primary: true,
      sort: (r) => r.stars,
      cell: (r) => (
        <>
          <Stars n={r.stars} />
          {r.text ? <span className="mt-1 line-clamp-2 block max-w-[48ch] font-normal">{r.text}</span> : <span className="mt-1 block text-sm font-normal text-muted">{t("noText")}</span>}
        </>
      ),
    },
    {
      id: "subject",
      header: t("col.subject"),
      sort: (r) => subjectName(r, names) ?? r.subjectType,
      cell: (r) => (
        <>
          <span className="block font-semibold">{subjectName(r, names) ?? kindLabel(r.subjectType)}</span>
          <span className="block text-xs text-muted">{kindLabel(r.subjectType)}</span>
        </>
      ),
    },
    {
      id: "member",
      header: t("col.member"),
      hideBelow: "lg",
      sort: (r) => r.createdAt,
      cell: (r) => (
        <>
          <span className="block">{r.author.displayName ?? t("member")}</span>
          <span className="block whitespace-nowrap text-xs text-muted">{formatDhaka(r.createdAt, locale)}</span>
        </>
      ),
    },
    {
      id: "reply",
      header: t("col.reply"),
      sort: (r) => replyState(r),
      cell: (r) => (
        <StatusBadge status={replyState(r)} domain="review">
          {t(`replyState.${replyState(r)}`)}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
      <PageTitle title={t("reviewsTitle")} description={t("reviewsIntroAll")} />
      <div className="mt-6 flex flex-col gap-4">
        {kinds.length > 1 || choosable.length > 1 ? (
          <FilterBar
            chips={
              kinds.length > 1
                ? {
                    value: values.type,
                    onChange: (v) => set({ type: v, place: null, id: null }),
                    label: t("filterKind"),
                    options: [{ value: "", label: t("allKinds") }, ...kinds.map((k) => ({ value: k, label: t(`subjectPlural.${k}`) }))],
                    testId: "review-kinds",
                  }
                : undefined
            }
            selects={
              choosable.length > 1
                ? [{ id: "place", label: t("filterPlace"), value: place ?? "", onChange: (v) => set({ place: v || null, id: null }), options: choosable.map((p) => ({ value: p.id, label: p.name })), anyLabel: t("allPlaces") }]
                : []
            }
            onClear={() => clear()}
          />
        ) : null}
        <DetailLayout open={Boolean(open)} onClose={() => set({ id: null })} title={t("reviewTitle")} pane={open ? picked ? <ReviewPane key={picked.id} review={picked} name={subjectName(picked, names) ?? kindLabel(picked.subjectType)} /> : <p className="text-muted">{t("pickReview")}</p> : null} width={480} testId="owner-review">
          <DataTable
            label={t("reviewsTitle")}
            testId="owner-reviews"
            columns={columns}
            rows={list.rows}
            rowId={(r) => r.id}
            loading={list.loading}
            error={list.error}
            onRetry={list.retry}
            empty={{ title: t("noReviews"), body: t("noReviewsBody") }}
            hasMore={list.hasMore}
            onMore={list.more}
            busy={list.busy}
            onRowClick={(r) => set({ id: r.id })}
            selectedId={open}
          />
        </DetailLayout>
      </div>
    </div>
  );
}

/** One review in full, and the owner's reply written in place (2 to 1,000 characters, no phone numbers or links). */
function ReviewPane({ review: r, name }: { review: ReviewRow; name: string }) {
  const t = useTranslations("vendorTrust");
  const locale = useLocale();
  const qc = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState(r.reply?.text ?? "");
  const reply = useMutation({
    mutationFn: () => ownerTrust.reply(r.id, text.trim()),
    onSuccess: () => {
      toast.show(r.reply ? t("replyChanged") : t("replyPosted"));
      void qc.invalidateQueries({ queryKey: ["owner-reviews"] });
    },
  });
  const problem = reply.error ? problemOf(reply.error) : null;
  return (
    <div className="flex flex-col gap-4" data-testid="owner-review-pane">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{name}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <Stars n={r.stars} />
          <span className="text-muted">
            {r.author.displayName ?? t("member")} · {formatDhaka(r.createdAt, locale)}
          </span>
        </p>
      </div>
      {r.text ? <p className="max-w-[65ch] whitespace-pre-line">{r.text}</p> : <p className="text-sm text-muted">{t("noText")}</p>}
      {r.reply ? (
        <div className="rounded-control border-l-4 border-line-strong/50 bg-surface-2/60 py-2 pl-3 text-sm">
          <p className="font-semibold">{t("yourReply")}</p>
          <p className="mt-1 whitespace-pre-line text-muted">{r.reply.text}</p>
        </div>
      ) : null}
      <form
        className="flex flex-col gap-3 border-t border-line pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (replyOk(text)) reply.mutate();
        }}
      >
        <Textarea id={`reply-${r.id}`} label={r.reply ? t("editReply") : t("writeReply")} hint={t("replyHint")} value={text} onChange={(e) => setText(e.target.value)} rows={4} minLength={2} maxLength={1000} />
        {reply.isError ? <Notice tone="error">{t(`replyErrors.${replyErrorKey(problem?.code)}`)}</Notice> : null}
        <div>
          <Button type="submit" disabled={!replyOk(text)} busy={reply.isPending} data-testid="send-reply">
            {r.reply ? t("saveReply") : t("reply")}
          </Button>
        </div>
      </form>
    </div>
  );
}
