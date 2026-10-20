"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { publicEnv } from "@kriraghor/session/env";
import { hire } from "@/lib/hire";
import { applyForRole, asOfRole, BUSINESS_ROLES, fileProblem, getRoleVerification, isPerson, MAX_UPLOAD_BYTES, missingFields, roleFromAs, submitBusiness, uploadBusinessFile, type BusinessDocType, type BusinessRole, type VerificationItem } from "@/lib/kyc";
import { Button, Notice } from "@kriraghor/ui/primitives";
import { OrganisationApply } from "./OrganisationApply";

const STATUS_CLS: Record<string, string> = { approved: "text-brand", in_review: "text-ink", changes_requested: "text-danger", rejected: "text-danger", missing: "text-muted" };
const CAN_SEND = ["missing", "changes_requested", "rejected", "withdrawn"];

/**
 * /account/business (M02 business documents): become a ground owner (M09), a shop owner (M12;
 * ?as=shop), a pro or a player for hire (M11; ?as=pro, ?as=player). The NID comes first (member
 * role); then apply, and send the role's documents:
 * - a ground owner: the trade licence and the land deed or lease (a TIN is optional);
 * - a shop owner: the trade licence and TIN (a BIN when VAT registered);
 * - a pro or player: a credential per hire role (its level sets the work they can take) and a police
 *   clearance for under-16 work.
 * Documents are kept per role. Staff check them. Once approved, the desk opens: vendor.kriraghor.com
 * for owners, kriraghor.com/pro for players and pros.
 */
export function BusinessPage() {
  const t = useTranslations("business");
  const locale = useLocale();
  const { status } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const role: BusinessRole = roleFromAs(useSearchParams().get("as"));
  const q = useQuery({ queryKey: ["business", locale, role], enabled: status === "signed_in", queryFn: () => getRoleVerification(locale, role) });
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["business"] });

  const pick = (r: BusinessRole) => router.replace(asOfRole(r) ? `${pathname}?as=${asOfRole(r)}` : pathname, { scroll: false });
  const tabs = (
    <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={t("pickRole")}>
      {BUSINESS_ROLES.map((r) => (
        <button key={r} type="button" aria-pressed={role === r} onClick={() => pick(r)} className={`min-h-11 border-2 px-4 font-bold ${role === r ? "border-brand bg-brand/10" : "border-line"}`} data-testid={`role-${r}`}>
          {t(`role.${r}.tab`)}
        </button>
      ))}
    </div>
  );

  if (status === "signed_out") {
    return (
      <Shell role={role}>
        <Notice>
          {t("signedOut")}{" "}
          <Link href={`/sign-in?next=/account/business${asOfRole(role) ? `?as=${asOfRole(role)}` : ""}`} className="underline">
            {t("signIn")}
          </Link>
        </Notice>
      </Shell>
    );
  }
  if (q.isPending) return <Shell role={role}>{tabs}{<div className="mt-6 h-40 animate-pulse bg-surface-2" role="status" aria-label={t("loading")} />}</Shell>;
  if (q.isError || !q.data) return <Shell role={role}>{tabs}{<Notice tone="error">{t("loadFailed")}</Notice>}</Shell>;
  const v = q.data;
  const vendorUrl = `${publicEnv().VENDOR_URL}/vendor`;

  return (
    <Shell role={role}>
      {tabs}
      {v.memberStatus !== "active" ? (
        <div className="mt-6" data-testid="business-needs-nid">
          <Notice>
            {t("needNid")}{" "}
            <Link href="/account/verification" className="font-bold underline">
              {t("verifyNid")}
            </Link>
          </Notice>
        </div>
      ) : !v.roleStatus || v.roleStatus === "withdrawn" ? (
        <div className="mt-6 glass-card p-5" data-testid="business-apply">
          <p className="font-bold">{t(`role.${role}.applyTitle`)}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {v.unlocks.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
          {problem ? (
            <div className="mt-3">
              <Notice tone="error">{problem.title}</Notice>
            </div>
          ) : null}
          <div className="mt-4">
            <Button
              type="button"
              busy={busy}
              onClick={async () => {
                setBusy(true);
                setProblem(null);
                try {
                  await applyForRole(role);
                  await refresh();
                } catch (err) {
                  setProblem(problemOf(err) ?? { code: "UNKNOWN", title: t("failed"), status: 0 });
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t(`role.${role}.apply`)}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className={`mt-6 border-2 p-4 ${v.roleStatus === "active" ? "border-brand" : "border-line"}`} data-testid="business-status">
            <p className="font-bold">{v.roleStatus === "active" ? t(`role.${role}.active`) : t(`roleStatus.${v.roleStatus}`)}</p>
            <p className="text-sm text-muted">{t("progress", { done: v.progress.approved, total: v.progress.total })}</p>
            {v.roleStatus === "active" && isPerson(role) ? (
              <Link href="/pro" className="mt-3 inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white hover:bg-brand-hover" data-testid="open-pro-desk">
                {t("openProDesk")}
              </Link>
            ) : v.roleStatus === "active" && role !== "organiser" ? (
              <a href={vendorUrl} className="mt-3 inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white hover:bg-brand-hover" data-testid="open-vendor">
                {t("openDesk")}
              </a>
            ) : null}
          </div>
          {role === "organiser" ? <OrganisationApply roleActive={v.roleStatus === "active"} /> : null}
          <ul className="mt-6 space-y-4" data-testid="business-items">
            {v.items.map((item) => (
              <DocItem key={item.key} item={item} role={role} onSent={refresh} credentials={"credentials" in v ? (v.credentials as Credential[]) : []} />
            ))}
          </ul>
        </>
      )}
    </Shell>
  );
}

function Shell({ role, children }: { role: BusinessRole; children: React.ReactNode }) {
  const t = useTranslations("business");
  return (
    <section className="mx-auto max-w-2xl px-5 pb-16 pt-8">
      <h1 className="text-3xl font-extrabold">{t(`role.${role}.title`)}</h1>
      <p className="mt-2 text-muted">{t(`role.${role}.intro`)}</p>
      {children}
    </section>
  );
}

type Credential = { hireRole: string | null; level: string | null; issuer: string | null; status: string; expiresOn: string | null; documentId: string };

function DocItem({ item, role, onSent, credentials }: { item: VerificationItem; role: BusinessRole; onSent: () => Promise<unknown>; credentials: Credential[] }) {
  const t = useTranslations("business");
  const locale = useLocale();
  const isCredential = item.key === "credential";
  // A credential is kept per hire role: pick the role and one of its tiers; another role can always be added.
  const tax = useQuery({ queryKey: ["hire-taxonomy"], queryFn: () => hire.taxonomy(), staleTime: 300_000, enabled: isCredential });
  const hireRoles = (tax.data?.items ?? []).filter((c) => c.forRole === role).flatMap((c) => c.roles).filter((r) => r.credentialTiers.length);
  const label = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canSend = isCredential || CAN_SEND.includes(item.status);
  const doc = item.document;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    if (missingFields(item.fields, values).length) return setProblem(t("fillAll"));
    if (!file) return setProblem(t("addFile"));
    const fp = fileProblem(file, MAX_UPLOAD_BYTES);
    if (fp) return setProblem(t(`file.${fp}`));
    setBusy(true);
    try {
      const up = await uploadBusinessFile(item.key as BusinessDocType, file);
      await submitBusiness(item.key as BusinessDocType, Object.fromEntries(item.fields.map((f) => [f.key, values[f.key]?.trim() || null])), up.fileId, role);
      setOpen(false);
      await onSent();
    } catch (err) {
      const p = problemOf(err);
      setProblem(p?.errors?.length ? p.errors.map((x) => x.message).join(" · ") : p?.title ?? t("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="glass-card p-4" data-testid={`business-item-${item.key}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-bold">{item.label}</span>
        {item.required === "optional" ? <span className="text-xs text-muted">{t("optional")}</span> : null}
        <span className={`ml-auto text-sm font-semibold ${STATUS_CLS[item.status] ?? "text-muted"}`}>{t(`status.${item.status}`)}</span>
      </div>
      {item.why ? <p className="mt-1 text-sm text-muted">{item.why}</p> : null}
      {doc?.reasonCode && ["changes_requested", "rejected"].includes(item.status) ? <p className="mt-1 text-sm text-danger">{t(`reason.${doc.reasonCode}`)}</p> : null}
      {doc?.numberMasked && !isCredential ? <p className="mt-1 text-sm">{t("number", { masked: doc.numberMasked })}</p> : null}
      {isCredential && credentials.length ? (
        <ul className="mt-2 divide-y-2 divide-line text-sm" data-testid="business-credentials">
          {credentials.map((c) => {
            const r = hireRoles.find((x) => x.key === c.hireRole);
            const tier = r?.credentialTiers.find((x) => x.level === c.level);
            return (
              <li key={c.documentId} className="flex flex-wrap justify-between gap-2 py-1">
                <span>
                  {r ? label(r) : c.hireRole} · {tier ? (locale === "bn" ? tier.labelBn : tier.labelEn) : c.level}
                </span>
                <span className={`font-semibold ${STATUS_CLS[c.status] ?? "text-muted"}`}>{t(`status.${c.status}`)}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {doc?.expiresOn ? <p className="text-sm text-muted">{t("validUntil", { date: doc.expiresOn })}</p> : null}
      {canSend && !open ? (
        <button type="button" className="mt-3 min-h-11 border-2 border-brand px-4 text-sm font-bold" onClick={() => setOpen(true)}>
          {isCredential ? t("addCredential") : item.status === "missing" ? t("send") : t("sendAgain")}
        </button>
      ) : null}
      {open ? (
        <form onSubmit={send} className="mt-3 grid gap-3">
          {item.fields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-sm font-semibold text-muted">
              {f.label}
              {f.required ? null : <span className="text-xs font-normal">{t("optional")}</span>}
              {isCredential && f.key === "hireRole" ? (
                <select value={values.hireRole ?? ""} onChange={(e) => setValues({ ...values, hireRole: e.target.value, level: "" })} className="min-h-12 field px-3 text-base text-ink" required data-testid="credential-role">
                  <option value="">{t("choose")}</option>
                  {hireRoles.map((r) => (
                    <option key={r.key} value={r.key}>
                      {label(r)}
                    </option>
                  ))}
                </select>
              ) : isCredential && f.key === "level" ? (
                <select value={values.level ?? ""} onChange={(e) => setValues({ ...values, level: e.target.value })} className="min-h-12 field px-3 text-base text-ink" required data-testid="credential-level">
                  <option value="">{t("choose")}</option>
                  {(hireRoles.find((r) => r.key === values.hireRole)?.credentialTiers ?? []).map((x) => (
                    <option key={x.level} value={x.level}>
                      {locale === "bn" ? x.labelBn : x.labelEn}
                    </option>
                  ))}
                </select>
              ) : f.type === "enum" ? (
                <select value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className="min-h-12 field px-3 text-base text-ink" required={f.required}>
                  <option value="">{t("choose")}</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {t(`option.${o}`)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === "date" ? "date" : "text"}
                  inputMode={f.type === "digits" ? "numeric" : undefined}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  className="min-h-12 field px-3 text-base text-ink"
                  required={f.required}
                />
              )}
            </label>
          ))}
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {t("file.label")}
            <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="min-h-12 field px-3 py-2 text-sm" data-testid={`file-${item.key}`} />
            <span className="text-xs font-normal">{t("file.hint")}</span>
          </label>
          {problem ? <Notice tone="error">{problem}</Notice> : null}
          <div className="flex gap-2">
            <Button type="submit" busy={busy}>
              {t("submit")}
            </Button>
            <button type="button" className="min-h-12 border-2 border-line px-4 font-bold" onClick={() => setOpen(false)}>
              {t("cancel")}
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
