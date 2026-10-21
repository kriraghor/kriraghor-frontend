"use client";

import { Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Paperclip, Star } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { Button, Card, DataTable, DetailLayout, EmptyState, Field, Notice, PageTitle, Skeleton, Textarea, buttonClass, cn, type Column } from "@kriraghor/ui/kit";
import { formatTaka } from "@/lib/admin/finance";
import { EVIDENCE_TYPES, ownerTrust } from "@/lib/vendor/trust";
import { useCursorList } from "@/lib/use-cursor-list";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../StatusBadge";
import { formatDhaka } from "../admin/useAdminMe";

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

/** /vendor/reviews (M17 FR-25): members' ratings of the owner's grounds; one reply each, editable. */
export function OwnerReviews() {
  const t = useTranslations("vendorTrust");
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["owner-reviews"], queryFn: () => ownerTrust.reviews() });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const reply = useMutation({ mutationFn: (id: string) => ownerTrust.reply(id, (draft[id] ?? "").trim()), onSuccess: () => qc.invalidateQueries({ queryKey: ["owner-reviews"] }) });

  return (
    <div className="mx-auto max-w-[960px] px-5 pb-16 pt-8">
      <PageTitle title={t("reviewsTitle")} description={t("reviewsIntro")} />
      {reply.error ? (
        <Notice tone="error" className="mt-4">
          {problemOf(reply.error)?.title}
        </Notice>
      ) : null}
      <div className="mt-6 flex flex-col gap-3" data-testid="owner-reviews">
        {q.isPending ? <Skeleton className="h-32" /> : null}
        {(q.data?.items ?? []).map((r) => (
          <Card key={r.id} className="flex flex-col gap-2">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Stars n={r.stars} />
              <span className="text-muted">
                {r.author.displayName ?? "–"} · {formatDhaka(r.createdAt, locale)}
              </span>
            </p>
            {r.text ? <p className="max-w-[65ch] whitespace-pre-line">{r.text}</p> : null}
            {r.reply ? <p className="rounded-control border-l-4 border-line-strong/50 bg-surface-2/60 py-2 pl-3 text-sm text-muted">{r.reply.text}</p> : null}
            <div className="flex flex-wrap items-end gap-2">
              <Field
                id={`reply-${r.id}`}
                label={r.reply ? t("editReply") : t("writeReply")}
                value={draft[r.id] ?? ""}
                onChange={(e) => setDraft({ ...draft, [r.id]: e.target.value })}
                placeholder={r.reply ? t("editReply") : t("writeReply")}
                maxLength={1000}
                className="min-w-0 flex-1"
              />
              <Button type="button" disabled={(draft[r.id] ?? "").trim().length < 2 || reply.isPending} busy={reply.isPending && reply.variables === r.id} onClick={() => reply.mutate(r.id)} data-testid="send-reply">
                {t("reply")}
              </Button>
            </div>
          </Card>
        ))}
        {!q.isPending && !q.data?.items.length ? <EmptyState title={t("noReviews")} /> : null}
      </div>
      <p className="mt-4 text-sm">
        <Link href="/vendor/venues" className="font-semibold text-brand-text underline">
          {t("toGrounds")}
        </Link>
      </p>
    </div>
  );
}
