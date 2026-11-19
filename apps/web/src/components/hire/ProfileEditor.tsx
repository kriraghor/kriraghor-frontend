"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@kriraghor/ui/i18n/navigation";
import { api, problemOf, type Problem } from "@kriraghor/api-client";
import { hire, LEVELS, limitKey, poishaToTaka, profileTone, rateOf, takaToPoisha, TONE, type Format, type Level, type OwnerProfile, type ProfileBody, type RateCardBody, type Unit } from "@/lib/hire";
import { formatTaka } from "@/lib/payments";
import { Button, Notice } from "@kriraghor/ui/primitives";
import { Avatar, BackLink } from "@kriraghor/ui/kit";
import { useMe } from "@kriraghor/ui/account";
import { AvatarControl } from "@/components/account/AvatarControl";
import { IntroVideo } from "./IntroVideo";

const EDITABLE = ["draft", "changes_requested", "rejected", "live", "paused"];
const input = "min-h-12 field px-3 text-base text-ink";
const label = "flex flex-col gap-1 text-sm font-semibold text-muted";
const problemText = (p: Problem | null, fallback: string) => (p ? (p.errors?.length ? p.errors.map((e) => e.message).join(" · ") : p.title) : fallback);

/**
 * /pro/profiles/[id] (M11 FR-10 to FR-14). "new" picks a hire role open to my platform role (players
 * list in category 01, pros in the rest) and creates a draft. An existing profile edits its working
 * copy and its rate card:
 * - each rate within the role's limits (Q74);
 * - night and short-notice surcharges;
 * - travel by zone (Dhaka north, south, outside);
 * - jobs per day.
 * Then it goes to review on the Moderation desk. A live profile stays up while an edit is reviewed.
 * Tester feedback (19 Nov 2026): the photo (the account photo, shown on every profile) is set here and is
 * needed to send for review (M11-FR-17); an intro video is a link, never uploaded (M11-FR-16).
 */
export function ProfileEditor({ id }: { id: string }) {
  const t = useTranslations("hire");
  const q = useQuery({ queryKey: ["pro-profile", id], queryFn: () => hire.myProfile(id), enabled: id !== "new", retry: false });
  if (id === "new") return <NewProfile />;
  if (q.isPending) return <div className="rounded-control h-64 kg-shimmer bg-surface-2" />;
  if (q.isError || !q.data) return <Notice tone="error">{t("desk.profileNotFound")}</Notice>;
  return <ExistingProfile p={q.data} />;
}

function NewProfile() {
  const t = useTranslations("hire");
  const locale = useLocale();
  const router = useRouter();
  const tax = useQuery({ queryKey: ["hire-taxonomy"], queryFn: () => hire.taxonomy(), staleTime: 300_000 });
  const me = useQuery({ queryKey: ["me"], queryFn: async () => (await api().GET("/me")).data });
  const [roleKey, setRoleKey] = useState("");
  const [values, setValues] = useState<Omit<ProfileBody, "roleKey">>({ headline: "", sportKeys: [], experienceLevel: "amateur", years: 0, baseAreaId: "", worksWithU16: false });
  const mine = new Set((me.data?.roles ?? []).filter((r) => ["player", "pro"].includes(r.role) && r.status !== "withdrawn").map((r) => r.role));
  const cats = (tax.data?.items ?? []).filter((c) => mine.has(c.forRole));
  const role = cats.flatMap((c) => c.roles).find((r) => r.key === roleKey);
  const create = useMutation({
    mutationFn: () => hire.createProfile({ roleKey, ...values, sportKeys: role?.sportKeys.slice(0, 1) ?? [] }),
    onSuccess: (p) => router.replace(`/pro/profiles/${p.id}`),
  });
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  return (
    <form
      className="flex max-w-2xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
      data-testid="pro-new"
    >
      <BackLink href="/pro">{t("desk.profiles")}</BackLink>
      <h2 className="text-2xl font-extrabold">{t("desk.newProfile")}</h2>
      <label className={label}>
        {t("role")}
        <select value={roleKey} onChange={(e) => setRoleKey(e.target.value)} required className={input} data-testid="pro-role">
          <option value="">{t("choose")}</option>
          {cats.map((c) => (
            <optgroup key={c.key} label={name(c)}>
              {c.roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {name(r)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {role?.requiresCredential ? <Notice>{t("desk.needsCredential")}</Notice> : null}
      <ProfileFields values={values} onChange={setValues} />
      {create.error ? <Notice tone="error">{problemText(problemOf(create.error), t("failed"))}</Notice> : null}
      <div>
        <Button busy={create.isPending} disabled={!roleKey} confirm="add" data-testid="pro-create">
          {t("desk.create")}
        </Button>
      </div>
    </form>
  );
}

function ProfileFields({ values, onChange }: { values: Omit<ProfileBody, "roleKey">; onChange: (v: Omit<ProfileBody, "roleKey">) => void }) {
  const t = useTranslations("hire");
  const locale = useLocale();
  const areas = useQuery({ queryKey: ["hire-areas"], queryFn: () => hire.areas(), staleTime: 300_000 });
  const set = (patch: Partial<Omit<ProfileBody, "roleKey">>) => onChange({ ...values, ...patch });
  return (
    <>
      <label className={label}>
        {t("desk.headline")}
        <input id="pro-headline" value={values.headline} onChange={(e) => set({ headline: e.target.value })} minLength={5} maxLength={80} required className={`${input} scroll-mt-28`} data-testid="pro-headline" />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className={label}>
          {t("experience")}
          <select value={values.experienceLevel} onChange={(e) => set({ experienceLevel: e.target.value as Level })} className={input}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {t(`level.${l}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t("desk.years")}
          <input type="number" min={0} max={60} value={values.years} onChange={(e) => set({ years: Number(e.target.value) })} className={input} />
        </label>
        <label className={label}>
          {t("baseArea")}
          <select value={values.baseAreaId} onChange={(e) => set({ baseAreaId: e.target.value })} required className={input} data-testid="pro-base-area">
            <option value="">{t("choose")}</option>
            {(areas.data?.items ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {locale === "bn" ? a.nameBn : a.nameEn}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={label}>
        {t("desk.bio")}
        <textarea id="pro-bio" value={values.bio ?? ""} onChange={(e) => set({ bio: e.target.value || undefined })} maxLength={2000} rows={4} className="surface-card scroll-mt-28 p-3 text-base text-ink" />
      </label>
      <label className={label}>
        <span>
          {t("desk.video")} <span className="font-normal">({t("optional")})</span>
        </span>
        <input id="pro-video" type="url" inputMode="url" value={values.introVideoUrl ?? ""} onChange={(e) => set({ introVideoUrl: e.target.value })} maxLength={500} placeholder="https://youtu.be/…" autoComplete="off" className={`${input} scroll-mt-28`} data-testid="pro-video" />
        <span className="text-xs font-normal leading-relaxed">{t("desk.videoHint")}</span>
      </label>
      <label className="flex min-h-11 items-center gap-3 font-semibold">
        <input type="checkbox" checked={values.worksWithU16} onChange={(e) => set({ worksWithU16: e.target.checked })} className="h-5 w-5" />
        {t("desk.u16")}
      </label>
    </>
  );
}

function ExistingProfile({ p }: { p: OwnerProfile }) {
  const t = useTranslations("hire");
  const locale = useLocale();
  const qc = useQueryClient();
  const [values, setValues] = useState<Omit<ProfileBody, "roleKey">>({
    headline: p.headline ?? "",
    specialisation: p.specialisation ?? undefined,
    sportKeys: p.sportKeys ?? [],
    experienceLevel: (p.experienceLevel ?? "amateur") as Level,
    years: p.years ?? 0,
    baseAreaId: p.baseAreaId ?? "",
    bio: p.bio ?? undefined,
    introVideoUrl: p.introVideoUrl ?? "",
    worksWithU16: Boolean(p.worksWithU16),
  });
  const { me } = useMe();
  const hasPhoto = Boolean(me.data?.avatarUrl);
  const set = (r: OwnerProfile) => qc.setQueryData(["pro-profile", p.id], r);
  const save = useMutation({ mutationFn: () => hire.updateProfile(p.id, { ...values, specialisation: values.specialisation || undefined, introVideoUrl: values.introVideoUrl?.trim() || null }), onSuccess: set });
  const submit = useMutation({ mutationFn: () => hire.submit(p.id), onSuccess: (r) => (set(r), qc.invalidateQueries({ queryKey: ["pro-profiles"] })) });
  const editable = EDITABLE.includes(p.status) && p.editStatus !== "pending_review";
  const err = [save, submit].map((m) => (m.error ? problemOf(m.error) : null)).find(Boolean);
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const a = useTranslations("ask");

  return (
    <div className="flex max-w-3xl flex-col gap-6" data-testid="pro-editor">
      <BackLink href="/pro">{t("desk.profiles")}</BackLink>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-2xl font-extrabold">{p.role ? name(p.role) : ""}</h2>
        <span className={`rounded-pill border px-2 py-0.5 text-sm font-bold ${TONE[profileTone(p.status)]}`} data-testid="pro-editor-status">
          {t(`profileStatus.${p.status}`)}
          {p.editStatus === "pending_review" ? ` · ${t("desk.editInReview")}` : ""}
        </span>
      </div>
      {p.reviewReason ? <Notice tone="error">{p.reviewReason.text ?? p.reviewReason.code}</Notice> : null}
      {p.status === "live" ? <Notice>{t("desk.liveNote")}</Notice> : null}
      <PhotoCard profileId={p.id} />
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <fieldset disabled={!editable} className="flex flex-col gap-4">
          <ProfileFields values={values} onChange={setValues} />
        </fieldset>
        {editable ? (
          <div>
            <Button busy={save.isPending} confirm="save" data-testid="pro-save">
              {t("desk.save")}
            </Button>
          </div>
        ) : null}
      </form>
      {p.introVideo ? (
        <div data-testid="pro-video-preview">
          <h3 className="text-lg font-extrabold">{t("desk.videoPreview")}</h3>
          <IntroVideo video={p.introVideo} title={t("video.title", { name: p.headline ?? "" })} testId="pro-intro-video" />
        </div>
      ) : null}
      <RateCardEditor p={p} disabled={!editable} onSaved={set} />
      {err ? <Notice tone="error">{err.code === "RATE_CARD_REQUIRED" ? t("desk.ratesFirst") : err.code === "PHOTO_REQUIRED" ? t("desk.photoFirst") : problemText(err, t("failed"))}</Notice> : null}
      {editable ? (
        <div className="border-t-2 border-line pt-4">
          {me.data && !hasPhoto ? (
            <p className="mb-3 text-sm font-semibold text-danger" data-testid="pro-photo-needed">
              <a href="#pro-photo" className="underline underline-offset-4">
                {t("desk.photoFirst")}
              </a>
            </p>
          ) : null}
          <Button busy={submit.isPending} disabled={!p.rateCard || (Boolean(me.data) && !hasPhoto)} confirm={{ kind: "send", title: a("submitProfile"), confirmLabel: t("desk.submit") }} onClick={() => submit.mutate()} data-testid="pro-submit">
            {t("desk.submit")}
          </Button>
          <p className="mt-2 text-sm text-muted">{t("desk.submitNote")}</p>
        </div>
      ) : null}
    </div>
  );
}

type Draft = { rates: Record<string, string>; nightPct: string; shortNoticePct: string; shortNoticeHours: string; north: string; south: string; outside: string; maxJobsPerDay: string };

function RateCardEditor({ p, disabled, onSaved }: { p: OwnerProfile; disabled: boolean; onSaved: (r: OwnerProfile) => void }) {
  const t = useTranslations("hire");
  const locale = useLocale();
  const role = p.role!;
  const options: { unit: Unit; format: Format | null }[] = (role.allowedUnits as Unit[]).flatMap((u): { unit: Unit; format: Format | null }[] => (u === "match" && role.formatPriced ? (role.formats as Format[]).map((f) => ({ unit: u, format: f })) : [{ unit: u, format: null }]));
  const c = p.rateCard;
  const [d, setD] = useState<Draft>({
    rates: Object.fromEntries(options.map((o) => [limitKey(o.unit, o.format), poishaToTaka(rateOf(c, o.unit, o.format))])),
    nightPct: String(c?.nightPct ?? 0),
    shortNoticePct: String(c?.shortNoticePct ?? 0),
    shortNoticeHours: String(c?.shortNoticeHours ?? 48),
    north: poishaToTaka(c?.travel.north ?? 0),
    south: poishaToTaka(c?.travel.south ?? 0),
    outside: poishaToTaka(c?.travel.outside ?? 0),
    maxJobsPerDay: String(c?.maxJobsPerDay ?? 2),
  });
  const body = (): RateCardBody => ({
    items: options.flatMap((o) => {
      const rate = takaToPoisha(d.rates[limitKey(o.unit, o.format)] ?? "");
      return rate === null ? [] : [{ unit: o.unit, ...(o.format ? { format: o.format } : {}), rate }];
    }),
    nightPct: Number(d.nightPct) || 0,
    shortNoticePct: Number(d.shortNoticePct) || 0,
    shortNoticeHours: Number(d.shortNoticeHours) || 0,
    travel: { north: takaToPoisha(d.north) ?? 0, south: takaToPoisha(d.south) ?? 0, outside: takaToPoisha(d.outside) ?? 0 },
    maxJobsPerDay: Number(d.maxJobsPerDay) || 1,
  });
  const save = useMutation({ mutationFn: () => hire.saveRateCard(p.id, body()), onSuccess: onSaved });
  const money = (n: number) => formatTaka(n, locale);
  const problem = save.error ? problemOf(save.error) : null;

  return (
    <form
      id="pro-rates"
      className="rounded-card flex scroll-mt-28 flex-col gap-4 border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      data-testid="pro-rate-card"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xl font-extrabold">{t("rates")}</h3>
        {c ? <span className="text-sm text-muted">{t("desk.version", { n: c.version })}</span> : null}
      </div>
      <fieldset disabled={disabled} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((o) => {
            const k = limitKey(o.unit, o.format);
            const lim = p.limits[k];
            return (
              <label key={k} className={label}>
                {o.unit === "match" ? (o.format ? t("perMatchFormat", { format: o.format }) : t("perMatch")) : t("perHour")}
                <input inputMode="decimal" value={d.rates[k] ?? ""} onChange={(e) => setD({ ...d, rates: { ...d.rates, [k]: e.target.value } })} placeholder="৳" className={input} data-testid={`rate-${k}`} />
                {lim ? <span className="text-xs font-normal">{t("desk.limit", { min: money(lim.min), max: money(lim.max) })}</span> : null}
              </label>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={label}>
            {t("desk.nightPct")}
            <input type="number" min={0} max={100} value={d.nightPct} onChange={(e) => setD({ ...d, nightPct: e.target.value })} className={input} />
          </label>
          <label className={label}>
            {t("desk.shortPct")}
            <input type="number" min={0} max={100} value={d.shortNoticePct} onChange={(e) => setD({ ...d, shortNoticePct: e.target.value })} className={input} />
          </label>
          <label className={label}>
            {t("desk.shortHours")}
            <input type="number" min={0} max={336} value={d.shortNoticeHours} onChange={(e) => setD({ ...d, shortNoticeHours: e.target.value })} className={input} />
          </label>
        </div>
        <fieldset>
          <legend className="text-sm font-bold">{t("desk.travel")}</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {(["north", "south", "outside"] as const).map((z) => (
              <label key={z} className={label}>
                {t(`zone.${z}`)}
                <input inputMode="decimal" value={d[z]} onChange={(e) => setD({ ...d, [z]: e.target.value })} className={input} data-testid={`travel-${z}`} />
              </label>
            ))}
          </div>
        </fieldset>
        <label className={`${label} max-w-xs`}>
          {t("desk.maxPerDay")}
          <input type="number" min={1} max={12} value={d.maxJobsPerDay} onChange={(e) => setD({ ...d, maxJobsPerDay: e.target.value })} className={input} />
        </label>
      </fieldset>
      {problem ? <Notice tone="error">{problemText(problem, t("failed"))}</Notice> : null}
      {save.isSuccess ? <Notice>{t("desk.ratesSaved")}</Notice> : null}
      {!disabled ? (
        <div>
          <Button busy={save.isPending} confirm="save" data-testid="pro-save-rates">
            {t("desk.saveRates")}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

/**
 * M11-FR-17: the person's photo, set right here. It is the account photo, so it shows on every hire profile,
 * the gym trainer cards and the account; it is needed to send a profile for review.
 */
function PhotoCard({ profileId }: { profileId: string }) {
  const t = useTranslations("hire");
  const qc = useQueryClient();
  const { me } = useMe();
  if (!me.data) return <div className="rounded-card h-28 kg-shimmer bg-surface-2" />;
  return (
    <section id="pro-photo" className="rounded-card flex scroll-mt-28 flex-col gap-3 border border-line p-4" data-testid="pro-photo">
      <div className="flex items-center gap-3">
        <Avatar name={me.data.displayName} src={me.data.avatarUrl ?? null} size={56} />
        <div className="min-w-0">
          <h3 className="text-xl font-extrabold">{t("desk.photo")}</h3>
          <p className="text-sm text-muted">{t("desk.photoLead")}</p>
        </div>
      </div>
      <AvatarControl me={me.data} onDone={() => void qc.invalidateQueries({ queryKey: ["pro-profile", profileId] })} />
    </section>
  );
}
