"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { api, problemOf } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { DECLINE_REASONS, hire, minutesLeft, profileTone, requestTone, TONE, type RequestResult } from "@/lib/hire";
import { formatTaka } from "@/lib/payments";
import { MePanel } from "../MePanel";
import { Button, Notice } from "../ui";
import { JobCard } from "./JobCard";

const TABS = [
  { href: "/pro", key: "profiles" },
  { href: "/pro/requests", key: "requests" },
  { href: "/pro/jobs", key: "jobs" },
  { href: "/pro/plans", key: "plans" },
] as const;
const OPEN_ROLE = ["applied", "documents_pending", "in_review", "active"];

/**
 * The pro desk on kriraghor.com/pro (M11; players and pros are people, so the desk lives here rather
 * than on the vendor portal): my profiles and their review, requests with the automatic checks, and
 * match day. Needs the player or pro role (applied on /account/business?as=pro).
 */
export function ProShell({ children }: { children: ReactNode }) {
  const t = useTranslations("hire");
  const { status } = useAuth();
  const pathname = usePathname();
  const me = useQuery({
    queryKey: ["me"],
    enabled: status === "signed_in",
    queryFn: async () => {
      const { data, error } = await api().GET("/me");
      if (error) throw error;
      return data;
    },
  });
  if (status === "signed_out") return <MePanel />;
  if (status === "loading" || me.isPending) return <div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />;
  const roles = (me.data?.roles ?? []).filter((r) => ["player", "pro"].includes(r.role) && OPEN_ROLE.includes(r.status));
  return (
    <section className="mx-auto max-w-[1100px] px-5 py-10" data-testid="pro-desk">
      <h1 className="text-3xl font-extrabold">{t("desk.title")}</h1>
      <p className="mt-2 max-w-2xl text-muted">{t("desk.lead")}</p>
      {!roles.length ? (
        <div className="mt-6 border-2 border-line p-5" data-testid="pro-apply">
          <p className="font-bold">{t("desk.applyFirst")}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/account/business?as=pro" className="inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white hover:bg-brand-hover">
              {t("desk.applyPro")}
            </Link>
            <Link href="/account/business?as=player" className="inline-flex min-h-12 items-center border-2 border-line px-5 font-bold hover:border-brand">
              {t("desk.applyPlayer")}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <nav aria-label={t("desk.title")} className="mt-6 flex gap-2 border-b-2 border-line">
            {TABS.map((x) => (
              <Link key={x.key} href={x.href} aria-current={pathname === x.href ? "page" : undefined} className={`-mb-0.5 min-h-11 border-b-4 px-4 py-2 font-bold ${pathname === x.href ? "border-brand" : "border-transparent text-muted"}`}>
                {t(`desk.${x.key}`)}
              </Link>
            ))}
          </nav>
          <div className="mt-6">{children}</div>
        </>
      )}
    </section>
  );
}

/** /pro: my hire profiles with their review state, pause and resume. */
export function ProProfiles() {
  const t = useTranslations("hire");
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pro-profiles"], queryFn: () => hire.myProfiles() });
  const pause = useMutation({ mutationFn: ({ id, on }: { id: string; on: boolean }) => hire.setPaused(id, on), onSuccess: () => qc.invalidateQueries({ queryKey: ["pro-profiles"] }) });
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const money = (n: number) => formatTaka(n, locale);
  if (q.isPending) return <div className="h-40 animate-pulse bg-surface-2" />;
  if (q.isError) return <Notice tone="error">{t("error")}</Notice>;
  return (
    <div>
      <Link href="/pro/profiles/new" className="inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white hover:bg-brand-hover" data-testid="pro-new-profile">
        {t("desk.newProfile")}
      </Link>
      {!q.data.items.length ? <p className="mt-6 border-2 border-dashed border-line p-8 text-center font-semibold">{t("desk.noProfiles")}</p> : null}
      <ul className="mt-6 flex flex-col gap-4">
        {q.data.items.map((p) => (
          <li key={p.id} className="border-2 border-line p-4" data-testid="pro-profile">
            <div className="flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold uppercase tracking-wide text-muted">{p.role ? name(p.role) : ""}</span>
                <span className="block text-lg font-extrabold">{p.headline}</span>
              </span>
              <span className={`border-2 px-2 py-0.5 text-sm font-bold ${TONE[profileTone(p.status)]}`} data-testid="pro-profile-status">
                {t(`profileStatus.${p.status}`)}
                {p.editStatus === "pending_review" ? ` · ${t("desk.editInReview")}` : ""}
              </span>
            </div>
            {p.rateCard ? <p className="mt-2 text-sm text-muted">{p.rateCard.items.map((i) => `${i.unit === "match" ? i.format ?? t("perMatch") : t("perHour")} ${money(i.rate)}`).join(" · ")}</p> : <p className="mt-2 text-sm text-danger">{t("desk.noRates")}</p>}
            {p.reviewReason ? <p className="mt-1 text-sm text-danger">{p.reviewReason.text ?? p.reviewReason.code}</p> : null}
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href={`/pro/profiles/${p.id}`} className="inline-flex min-h-11 items-center border-2 border-line px-4 font-bold hover:border-brand">
                {t("desk.edit")}
              </Link>
              {["live", "paused"].includes(p.status) ? (
                <Link href={`/hiring/${p.slug}`} className="inline-flex min-h-11 items-center font-semibold text-brand underline">
                  {t("desk.viewPublic")}
                </Link>
              ) : null}
              {p.status === "live" || p.status === "paused" ? (
                <button type="button" disabled={pause.isPending} onClick={() => pause.mutate({ id: p.id, on: p.status === "live" })} className="min-h-11 border-2 border-line px-4 font-bold disabled:opacity-50">
                  {p.status === "live" ? t("desk.pause") : t("desk.resume")}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** /pro/requests: requests to answer first (with the checks and the reply deadline), then the rest. */
export function ProRequests() {
  const t = useTranslations("hire");
  const q = useQuery({ queryKey: ["pro-requests"], queryFn: () => hire.requests(), refetchInterval: 30_000 });
  if (q.isPending) return <div className="h-40 animate-pulse bg-surface-2" />;
  if (q.isError) return <Notice tone="error">{t("error")}</Notice>;
  const items = [...q.data.items].sort((a, b) => Number(b.request.status === "pending") - Number(a.request.status === "pending"));
  if (!items.length) return <p className="border-2 border-dashed border-line p-8 text-center font-semibold">{t("desk.noRequests")}</p>;
  return (
    <ul className="flex flex-col gap-4" data-testid="pro-requests">
      {items.map((x) => (
        <ProRequest key={x.request.id} x={x} />
      ))}
    </ul>
  );
}

function ProRequest({ x }: { x: RequestResult }) {
  const t = useTranslations("hire");
  const locale = useLocale();
  const qc = useQueryClient();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState<(typeof DECLINE_REASONS)[number]>("not_available");
  const done = () => Promise.all([qc.invalidateQueries({ queryKey: ["pro-requests"] }), qc.invalidateQueries({ queryKey: ["pro-jobs"] })]);
  const accept = useMutation({ mutationFn: () => hire.accept(x.request.id), onSuccess: done });
  const decline = useMutation({ mutationFn: () => hire.decline(x.request.id, reason), onSuccess: done });
  const err = [accept, decline].map((m) => (m.error ? problemOf(m.error) : null)).find(Boolean);
  const r = x.request;
  const lines = (r.quote as { lines?: { start: string; format: string | null; venueText: string; total: number }[] }).lines ?? [];
  const when = (iso: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso));
  const money = (n: number) => formatTaka(n, locale);
  const failed = (x.checks ?? []).filter((c) => !c.ok);

  return (
    <li className="border-2 border-line" data-testid="pro-request">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-line px-4 py-3">
        <div>
          <p className="font-extrabold">
            {r.other.name} · {money(r.money.total)}
          </p>
          <p className="text-xs text-muted">
            {r.code}
            {r.status === "pending" && r.replyBy ? ` · ${t("replyWithin", { min: minutesLeft(r.replyBy) })}` : ""}
          </p>
        </div>
        <span className={`border-2 px-2 py-0.5 text-sm font-bold ${TONE[requestTone(r.status)]}`}>{t(`requestStatus.${r.status}`)}</span>
      </header>
      <ul className="divide-y-2 divide-line px-4 text-sm">
        {lines.map((l) => (
          <li key={l.start} className="flex flex-wrap justify-between gap-2 py-2">
            <span>
              <strong>{when(l.start)}</strong> {l.format ? `· ${l.format}` : ""} · {l.venueText}
            </span>
            <span className="tabular-nums">{money(l.total)}</span>
          </li>
        ))}
      </ul>
      {r.note ? <p className="border-t-2 border-line px-4 py-2 text-sm">{r.note}</p> : null}
      {x.checks ? (
        <ul className="flex flex-wrap gap-2 border-t-2 border-line px-4 py-3" aria-label={t("checks")} data-testid="pro-checks">
          {x.checks.map((c) => (
            <li key={c.key} className={`border-2 px-2 py-0.5 text-xs font-bold ${c.ok ? "border-brand text-brand" : "border-danger text-danger"}`}>
              {c.ok ? "✓" : "✕"} {t(`check.${c.key}`)}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-3 border-t-2 border-line px-4 py-3">
        {r.status === "pending" ? (
          <>
            <Button busy={accept.isPending} disabled={failed.length > 0} onClick={() => accept.mutate()} data-testid="pro-accept">
              {t("accept")}
            </Button>
            {!declining ? (
              <button type="button" className="min-h-12 border-2 border-line px-4 font-bold hover:border-brand" onClick={() => setDeclining(true)} data-testid="pro-decline">
                {t("decline")}
              </button>
            ) : null}
          </>
        ) : null}
        <Link href={`/me/hire/${r.code}`} className="inline-flex min-h-12 items-center font-semibold text-brand underline">
          {t("openRequest")}
        </Link>
      </div>
      {declining ? (
        <form
          className="flex flex-wrap items-end gap-3 border-t-2 border-line px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            decline.mutate();
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {t("declineWhy")}
            <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className="min-h-12 border-2 border-line bg-surface px-3 text-base text-ink">
              {DECLINE_REASONS.map((d) => (
                <option key={d} value={d}>
                  {t(`declineReason.${d}`)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={decline.isPending} className="min-h-12 border-2 border-danger px-4 font-bold text-danger disabled:opacity-50">
            {t("decline")}
          </button>
        </form>
      ) : null}
      {err ? (
        <div className="px-4 pb-3">
          <Notice tone="error">{err.code === "CHECKS_FAILED" ? t("checksFailed") : err.code === "SCHEDULE_CLASH" ? t("clash") : (err.title ?? t("failed"))}</Notice>
        </div>
      ) : null}
    </li>
  );
}

/** /pro/jobs: today and coming up, with check in, start, mark complete and withdraw. */
export function ProJobs() {
  const t = useTranslations("hire");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pro-jobs"], queryFn: () => hire.jobs(), refetchInterval: 60_000 });
  if (q.isPending) return <div className="h-40 animate-pulse bg-surface-2" />;
  if (q.isError) return <Notice tone="error">{t("error")}</Notice>;
  if (!q.data.items.length) return <p className="border-2 border-dashed border-line p-8 text-center font-semibold">{t("desk.noJobs")}</p>;
  return (
    <div className="flex flex-col gap-4" data-testid="pro-jobs">
      {q.data.items.map((j) => (
        <div key={j.id}>
          {j.requestCode ? (
            <Link href={`/me/hire/${j.requestCode}`} className="mb-1 inline-block text-sm font-semibold text-brand underline">
              {t("openRequest")}
            </Link>
          ) : null}
          <JobCard job={j} side="pro" onChange={() => qc.invalidateQueries({ queryKey: ["pro-jobs"] })} />
        </div>
      ))}
    </div>
  );
}
