"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Buildings, CheckCircle, HourglassMedium, LockSimple, Plus, Storefront, Trash, UploadSimple, UserPlus } from "@phosphor-icons/react";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { useRouter } from "@kriraghor/ui/i18n/navigation";
import { Badge, Button, ButtonLink, Card, Checkbox, Field as KitField, Notice, Skeleton } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { Field, inputCls, useWorkplaces } from "@kriraghor/ui/desk";
import { webHref } from "@/lib/links";
import { gymDesk, type OwnerGym } from "@/lib/manage";
import { applyAsGymOwner, startStep } from "@/lib/start";
import { gymManage, packageRowsOf, packagesPayload, privateStep, SHORT_CODE, starterRows, suggestShortCode, type PackageRow, type PrivateStep } from "@/lib/gym-manage";
import { useGymError, useManageGyms, usePackages } from "@/components/gym-manage/common";

/**
 * /start (M24-FR-01, FR-09; §4.1 onboarding). Two ways in:
 *  - **Private gym** (manage members without a public listing): sign in, a verified phone, then the gym
 *    (name, area, address; POST /me/gyms, a draft that is never listed), the short code for member codes
 *    and receipts, the packages (month, 3, 6 and 12 months, custom days, admission fee; sold at the
 *    desk), then Import, Add the first member or Skip → /manage/[gymId]. The step lives in the URL
 *    (?gym=&step=), so a reload or "Set up" from /manage resumes it.
 *  - **A gym members can find**: the gym owner application and documents (M02), then the listed draft.
 * An owner who already has gyms goes to /manage (unless resuming a gym's setup).
 */
export function Start() {
  const t = useTranslations("start");
  const { status } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const params = useSearchParams();
  const wp = useWorkplaces();
  const gyms = useManageGyms(status === "signed_in");
  const gymId = params.get("gym");
  const ownsGyms = (gyms.data?.items ?? []).some((g) => g.role === "owner");
  const [applyProblem, setApplyProblem] = useState<Problem | null>(null);
  const apply = useMutation({
    mutationFn: () => applyAsGymOwner(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["vendor-me"] }),
    onError: (e) => setApplyProblem(problemOf(e)),
  });
  // An owner who arrives with gyms goes to /manage; not while this page is creating one (the new gym
  // lands in the list before the ?gym= step URL does).
  const creating = useRef(false);
  const redirect = status === "signed_in" && !gymId && !params.get("path") && ownsGyms;
  useEffect(() => {
    if (redirect && !creating.current) router.replace("/manage");
  }, [redirect, router]);

  if (status === "loading" || (status === "signed_in" && (wp.me.isPending || gyms.isPending))) {
    return (
      <section className="mx-auto max-w-[960px] px-5 py-12">
        <Skeleton className="h-64 rounded-card" />
      </section>
    );
  }
  const signedIn = status === "signed_in";
  const gym = (gyms.data?.items ?? []).find((g) => g.id === gymId && g.role === "owner") ?? null;
  const pStep = privateStep({ signedIn, phoneVerified: wp.phoneVerified, gymId: gym ? gymId : null, step: params.get("step"), setupDone: gym?.setupDone });
  const step = startStep(signedIn, wp.me.data?.roles);

  return (
    <section className="mx-auto max-w-[960px] px-4 py-8 sm:px-5 md:py-12" data-testid="start" data-step={step} data-private-step={pStep}>
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">{t("kicker")}</p>
      <h1 className="mt-2 text-3xl font-extrabold md:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-muted">{t("lead")}</p>

      {gym ? (
        <Card className="mt-8 flex flex-col gap-4" data-testid="start-private">
          <Stepper step={pStep} />
          <PrivateBody step={pStep} gymId={gym.id} gymName={gym.name} shortCode={gym.shortCode} />
        </Card>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card className="flex flex-col gap-4 border-brand/60" data-testid="start-private">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-brand-soft text-brand-text">
                <LockSimple size={24} aria-hidden />
              </span>
              <div>
                <h2 className="flex flex-wrap items-center gap-2 text-xl font-extrabold">
                  {t("private.title")} <Badge tone="brand">{t("private.badge")}</Badge>
                </h2>
                <p className="mt-1 text-sm text-muted">{t("private.body")}</p>
              </div>
            </div>
            <PrivateBody step={pStep} gymId={null} gymName={null} shortCode={null} onCreating={() => (creating.current = true)} />
          </Card>

          <Card className="flex flex-col gap-4" data-testid="start-public">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-surface-2 text-ink">
                <Storefront size={24} aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-extrabold">{t("public.title")}</h2>
                <p className="mt-1 text-sm text-muted">{t("public.body")}</p>
              </div>
            </div>
            <StepBody step={step} applying={apply.isPending} onApply={() => (setApplyProblem(null), apply.mutate())} problem={applyProblem} />
          </Card>
        </div>
      )}
    </section>
  );
}

const STEPS: PrivateStep[] = ["gym", "code", "packages", "next"];

function Stepper({ step }: { step: PrivateStep }) {
  const t = useTranslations("start.privateFlow");
  const at = STEPS.indexOf(step);
  return (
    <ol className="grid grid-cols-4 gap-1 text-xs font-semibold sm:text-sm" aria-label={t("steps")}>
      {STEPS.map((s, i) => (
        <li key={s} className={cn("flex flex-col gap-1 border-t-4 pt-1.5", i < at ? "border-brand text-brand-text" : i === at ? "border-brand text-ink" : "border-line text-muted")} aria-current={i === at ? "step" : undefined}>
          <span>{i + 1}</span>
          <span className="leading-tight">{t(`step.${s}`)}</span>
        </li>
      ))}
    </ol>
  );
}

function PrivateBody({ step, gymId, gymName, shortCode, onCreating }: { step: PrivateStep; gymId: string | null; gymName: string | null; shortCode: string | null; onCreating?: () => void }) {
  const t = useTranslations("start");
  switch (step) {
    case "signIn":
      return (
        <div className="flex flex-col gap-3">
          <p>{t("signIn.body")}</p>
          <ButtonLink href="/sign-in?next=/start" iconEnd={<ArrowRight size={18} aria-hidden />} data-testid="start-sign-in">
            {t("signIn.cta")}
          </ButtonLink>
        </div>
      );
    case "phone":
      return (
        <Notice tone="warning" title={t("privateFlow.phoneTitle")} action={<ButtonLink href={webHref("/account/settings")} size="sm">{t("privateFlow.phoneCta")}</ButtonLink>}>
          {t("privateFlow.phoneBody")}
        </Notice>
      );
    case "gym":
      return <CreateGym onCreating={onCreating} />;
    case "code":
      return gymId ? <ShortCode gymId={gymId} gymName={gymName ?? ""} current={shortCode} /> : null;
    case "packages":
      return gymId ? <StarterPackages gymId={gymId} /> : null;
    case "next":
      return gymId ? <NextStep gymId={gymId} /> : null;
  }
}

/** Step 1: the gym (a private draft: never in the directory until it is submitted and published). */
function CreateGym({ onCreating }: { onCreating?: () => void }) {
  const t = useTranslations("start.create");
  const tv = useTranslations("vendorGym");
  const tp = useTranslations("start.privateFlow");
  const router = useRouter();
  const qc = useQueryClient();
  const areas = useQuery({ queryKey: ["gym-areas"], queryFn: () => gymDesk.areas() });
  const [f, setF] = useState({ name: "", areaId: "", addressLine: "" });
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    setBusy(true);
    onCreating?.();
    try {
      const g = await gymDesk.create({ name: f.name, areaId: f.areaId, addressLine: f.addressLine });
      router.replace(`/start?gym=${g.id}&step=code`);
      await qc.invalidateQueries({ queryKey: ["manage-gyms"] });
      await qc.invalidateQueries({ queryKey: ["vendor-gyms"] });
    } catch (err) {
      setProblem(problemOf(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-testid="start-create">
      <p className="flex items-center gap-2 font-semibold">
        <Buildings size={20} className="text-brand" aria-hidden /> {t("title")}
      </p>
      <p className="text-sm text-muted">{tp("gymBody")}</p>
      <Field label={tv("form.name")}>
        <input value={f.name} onChange={(e) => set("name", e.target.value)} minLength={3} maxLength={120} required className={inputCls} data-testid="start-name" />
      </Field>
      <Field label={tv("form.area")}>
        <select value={f.areaId} onChange={(e) => set("areaId", e.target.value)} required className={inputCls} data-testid="start-area">
          <option value="">{tv("form.chooseArea")}</option>
          {(areas.data?.items ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.nameEn}
            </option>
          ))}
        </select>
      </Field>
      <Field label={tv("form.address")}>
        <input value={f.addressLine} onChange={(e) => set("addressLine", e.target.value)} minLength={5} maxLength={300} required className={inputCls} data-testid="start-address" />
      </Field>
      {problem ? <Notice tone="error">{problem.errors?.map((e) => e.message).join(" · ") || problem.title}</Notice> : null}
      <Button type="submit" busy={busy} data-testid="start-create-submit" className="self-start">
        {tp("createGym")}
      </Button>
    </form>
  );
}

/** Step 2: the short code ({SHORT}-0001 member codes, {SHORT}-R26-000001 receipts). The first save sets the gym up. */
function ShortCode({ gymId, gymName, current }: { gymId: string; gymName: string; current: string | null }) {
  const t = useTranslations("start.privateFlow");
  const err = useGymError();
  const qc = useQueryClient();
  const router = useRouter();
  const [code, setCode] = useState(current ?? suggestShortCode(gymName));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const ok = SHORT_CODE.test(code);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return setProblem(t("codeHint"));
    setBusy(true);
    setProblem(null);
    try {
      if (code !== current) await gymManage.saveSettings(gymId, { shortCode: code });
      await qc.invalidateQueries({ queryKey: ["manage-gyms"] });
      router.replace(`/start?gym=${gymId}&step=packages`);
    } catch (e2) {
      setProblem(err(e2));
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-testid="start-code">
      <h2 className="text-xl font-extrabold">{t("codeTitle", { gym: gymName })}</h2>
      <p className="text-sm text-muted">{t("codeBody")}</p>
      <KitField
        id="start-code-input"
        label={t("codeLabel")}
        value={code}
        maxLength={6}
        autoCapitalize="characters"
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
        hint={ok ? t("codeExample", { member: `${code}-0001`, receipt: `${code}-R${new Date().getFullYear() % 100}-000001` }) : t("codeHint")}
        error={code && !ok ? t("codeHint") : undefined}
        inputClassName="font-mono text-2xl tracking-[0.3em] uppercase"
        data-testid="start-code-input"
      />
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <Button type="submit" busy={busy} className="self-start" data-testid="start-code-submit">
        {t("continue")}
      </Button>
    </form>
  );
}

/** Step 3: the first packages (sold at the desk): month on by default, 3, 6 and 12 months, custom days; one admission fee for all. */
function StarterPackages({ gymId }: { gymId: string }) {
  const tg = useTranslations("gm");
  const err = useGymError();
  const packages = usePackages(gymId, true);
  if (!packages.q.data) return packages.q.isError ? <Notice tone="error">{err(packages.q.error)}</Notice> : <Skeleton className="h-48 rounded-card" />;
  const saved = packageRowsOf(packages.q.data.packages);
  return (
    <StarterRows
      gymId={gymId}
      limits={packages.q.data.limits}
      initial={saved.length ? saved : starterRows({ month: tg("kindTitle.month"), quarter: tg("kindTitle.quarter"), half_year: tg("kindTitle.half_year"), year: tg("kindTitle.year") })}
      initialFee={saved.find((r) => r.admissionTaka)?.admissionTaka ?? ""}
    />
  );
}

function StarterRows({ gymId, limits, initial, initialFee }: { gymId: string; limits: OwnerGym["limits"]; initial: PackageRow[]; initialFee: string }) {
  const t = useTranslations("start.privateFlow");
  const tg = useTranslations("gm");
  const err = useGymError();
  const router = useRouter();
  const qc = useQueryClient();
  const [rows, setRows] = useState<PackageRow[]>(initial);
  const [admission, setAdmission] = useState(initialFee);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const update = (i: number, patch: Partial<PackageRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const submit = async () => {
    setProblem(null);
    const withFee = rows.map((r) => ({ ...r, admissionTaka: r.kind === "day" ? r.admissionTaka : admission }));
    const body = packagesPayload(withFee, limits?.maxCustomPackages ?? 5);
    if (!body.ok) return setProblem(tg(`packages.problem.${body.problem}`, { max: limits?.maxCustomPackages ?? 5 }));
    setBusy(true);
    try {
      const saved = await gymDesk.setPackages(gymId, body.packages);
      qc.setQueryData(["vendor-gym", gymId], saved);
      router.replace(`/start?gym=${gymId}&step=next`);
    } catch (e) {
      setProblem(err(e));
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3" data-testid="start-packages">
      <h2 className="text-xl font-extrabold">{t("packagesTitle")}</h2>
      <p className="text-sm text-muted">{t("packagesBody")}</p>
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={i} className={cn("grid items-end gap-2 rounded-control border p-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_8rem_auto]", r.on ? "border-line" : "border-dashed border-line opacity-70")} data-testid="start-package">
            <Checkbox id={`sp-on-${i}`} label={r.kind === "custom" ? tg("kind.custom") : tg(`kind.${r.kind}`)} checked={r.on} onChange={(e) => update(i, { on: e.target.checked })} />
            <KitField id={`sp-title-${i}`} label={tg("packages.titleLabel")} value={r.title} maxLength={80} disabled={!r.on} onChange={(e) => update(i, { title: e.target.value })} />
            <KitField id={`sp-price-${i}`} label={tg("packages.price")} inputMode="decimal" value={r.taka} disabled={!r.on} onChange={(e) => update(i, { taka: e.target.value })} leading={<span className="text-muted">৳</span>} data-testid={`sp-price-${r.kind}`} />
            {r.kind === "custom" ? (
              <div className="flex items-end gap-1">
                <KitField id={`sp-days-${i}`} label={tg("packages.days")} inputMode="numeric" value={r.days} disabled={!r.on} onChange={(e) => update(i, { days: e.target.value })} className="w-24" />
                <Button type="button" variant="ghost" icon={<Trash size={16} aria-hidden />} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  <span className="sr-only">{tg("packages.retire")}</span>
                </Button>
              </div>
            ) : (
              <span className="pb-3 text-sm text-muted">{limits ? tg("packages.daysN", { n: (limits.kindDays as Record<string, number>)[r.kind] ?? 0 }) : null}</span>
            )}
          </li>
        ))}
      </ul>
      <Button type="button" variant="secondary" size="sm" icon={<Plus size={16} aria-hidden />} className="self-start" onClick={() => setRows([...rows, { kind: "custom", title: tg("kindTitle.custom"), taka: "", days: "15", admissionTaka: "", channel: "desk", visitLimit: "", on: true }])}>
        {t("addCustom")}
      </Button>
      <KitField id="sp-admission" label={t("admission")} optional={tg("optional")} hint={t("admissionHint")} inputMode="decimal" value={admission} onChange={(e) => setAdmission(e.target.value)} leading={<span className="text-muted">৳</span>} className="max-w-xs" />
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={submit} busy={busy} data-testid="start-packages-submit">
          {t("continue")}
        </Button>
      </div>
    </div>
  );
}

/** Step 4: how to fill the list: import a file, add the first member, or go to the dashboard. */
function NextStep({ gymId }: { gymId: string }) {
  const t = useTranslations("start.privateFlow");
  return (
    <div className="flex flex-col gap-3" data-testid="start-next">
      <p className="flex items-center gap-2 text-xl font-extrabold">
        <CheckCircle size={24} weight="fill" className="text-brand" aria-hidden /> {t("ready")}
      </p>
      <p className="text-sm text-muted">{t("nextBody")}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <ButtonLink href={`/manage/${gymId}/import`} icon={<UploadSimple size={18} aria-hidden />} data-testid="start-import">
          {t("import")}
        </ButtonLink>
        <ButtonLink href={`/manage/${gymId}/members/new`} variant="secondary" icon={<UserPlus size={18} aria-hidden />} data-testid="start-first-member">
          {t("firstMember")}
        </ButtonLink>
        <ButtonLink href={`/manage/${gymId}`} variant="ghost" data-testid="start-skip">
          {t("skip")}
        </ButtonLink>
      </div>
    </div>
  );
}

function StepBody({ step, applying, onApply, problem }: { step: ReturnType<typeof startStep>; applying: boolean; onApply: () => void; problem: Problem | null }) {
  const t = useTranslations("start");
  switch (step) {
    case "signIn":
      return <p className="text-sm text-muted">{t("public.signInFirst")}</p>;
    case "apply":
      return (
        <div className="flex flex-col gap-3">
          <p>{t("apply.body")}</p>
          <Button type="button" variant="secondary" onClick={onApply} busy={applying} data-testid="start-apply">
            {t("apply.cta")}
          </Button>
          {problem ? <Notice tone="error">{problem.title}</Notice> : null}
        </div>
      );
    case "documents":
      return (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle size={20} weight="fill" className="text-brand" aria-hidden /> {t("documents.applied")}
          </p>
          <p>{t("documents.body")}</p>
          <ButtonLink href={webHref("/account/business?as=gym")} variant="secondary" iconEnd={<ArrowRight size={18} aria-hidden />} data-testid="start-documents">
            {t("documents.cta")}
          </ButtonLink>
        </div>
      );
    case "review":
      return (
        <p className="flex items-start gap-2" data-testid="start-review">
          <HourglassMedium size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden /> {t("review.body")}
        </p>
      );
    case "suspended":
      return <Notice tone="warning">{t("suspended.body")}</Notice>;
    case "create":
      return (
        <div className="flex flex-col gap-3">
          <p>{t("public.ready")}</p>
          <ButtonLink href="/manage" variant="secondary">
            {t("create.toManage")}
          </ButtonLink>
        </div>
      );
  }
}
