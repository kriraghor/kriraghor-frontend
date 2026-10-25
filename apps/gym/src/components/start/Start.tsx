"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowRight, Buildings, CheckCircle, HourglassMedium, LockSimple, Storefront } from "@phosphor-icons/react";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { useRouter } from "@kriraghor/ui/i18n/navigation";
import { Badge, Button, ButtonLink, Card, Notice, Skeleton } from "@kriraghor/ui/kit";
import { Field, inputCls, useWorkplaces } from "@kriraghor/ui/desk";
import { webHref } from "@/lib/links";
import { gymDesk } from "@/lib/manage";
import { applyAsGymOwner, startStep } from "@/lib/start";

/**
 * /start (M24 prompt 0). Signed out: sign in, coming back here. Signed in: apply for the gym owner
 * role (M02), then send the documents on kriraghor.com (the business page, ?as=gym); once the role is
 * active, create the gym (the M20 draft, POST /me/gyms, the same form as /manage) and continue in its
 * editor. A private gym (managed without a public listing) needs the M24 backend: "Coming soon".
 */
export function Start() {
  const t = useTranslations("start");
  const { status } = useAuth();
  const qc = useQueryClient();
  const wp = useWorkplaces();
  const [applyProblem, setApplyProblem] = useState<Problem | null>(null);
  const apply = useMutation({
    mutationFn: () => applyAsGymOwner(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["vendor-me"] }),
    onError: (e) => setApplyProblem(problemOf(e)),
  });

  if (status === "loading" || (status === "signed_in" && wp.me.isPending)) {
    return (
      <section className="mx-auto max-w-[960px] px-5 py-12">
        <Skeleton className="h-64 rounded-card" />
      </section>
    );
  }
  const step = startStep(status === "signed_in", wp.me.data?.roles);

  return (
    <section className="mx-auto max-w-[960px] px-5 py-12" data-testid="start" data-step={step}>
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">{t("kicker")}</p>
      <h1 className="mt-2 text-4xl font-extrabold md:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-muted">{t("lead")}</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-4" data-testid="start-public">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-brand-soft text-brand-text">
              <Storefront size={24} aria-hidden />
            </span>
            <div>
              <h2 className="text-xl font-extrabold">{t("public.title")}</h2>
              <p className="mt-1 text-sm text-muted">{t("public.body")}</p>
            </div>
          </div>
          <StepBody step={step} applying={apply.isPending} onApply={() => (setApplyProblem(null), apply.mutate())} problem={applyProblem} />
        </Card>

        <Card className="flex flex-col gap-4 opacity-80" data-testid="start-private">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-surface-2 text-muted">
              <LockSimple size={24} aria-hidden />
            </span>
            <div>
              <h2 className="flex flex-wrap items-center gap-2 text-xl font-extrabold">
                {t("private.title")} <Badge>{t("comingSoon")}</Badge>
              </h2>
              <p className="mt-1 text-sm text-muted">{t("private.body")}</p>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

function StepBody({ step, applying, onApply, problem }: { step: ReturnType<typeof startStep>; applying: boolean; onApply: () => void; problem: Problem | null }) {
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
    case "apply":
      return (
        <div className="flex flex-col gap-3">
          <p>{t("apply.body")}</p>
          <Button type="button" onClick={onApply} busy={applying} data-testid="start-apply">
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
          <ButtonLink href={webHref("/account/business?as=gym")} iconEnd={<ArrowRight size={18} aria-hidden />} data-testid="start-documents">
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
      return <CreateGym />;
  }
}

/** "Create your gym": name, area and address (photos, hours and packages follow in the editor). */
function CreateGym() {
  const t = useTranslations("start.create");
  const tv = useTranslations("vendorGym");
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
    try {
      const g = await gymDesk.create({ name: f.name, areaId: f.areaId, addressLine: f.addressLine });
      await qc.invalidateQueries({ queryKey: ["vendor-gyms"] });
      router.push(`/manage/${g.id}/edit`);
    } catch (err) {
      setProblem(problemOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-testid="start-create">
      <p className="flex items-center gap-2 font-semibold">
        <Buildings size={20} className="text-brand" aria-hidden /> {t("title")}
      </p>
      <Field label={tv("form.name")}>
        <input value={f.name} onChange={(e) => set("name", e.target.value)} minLength={3} maxLength={120} required className={inputCls} />
      </Field>
      <Field label={tv("form.area")}>
        <select value={f.areaId} onChange={(e) => set("areaId", e.target.value)} required className={inputCls}>
          <option value="">{tv("form.chooseArea")}</option>
          {(areas.data?.items ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.nameEn}
            </option>
          ))}
        </select>
      </Field>
      <Field label={tv("form.address")}>
        <input value={f.addressLine} onChange={(e) => set("addressLine", e.target.value)} minLength={5} maxLength={300} required className={inputCls} />
      </Field>
      {problem ? <Notice tone="error">{problem.errors?.map((e) => e.message).join(" · ") || problem.title}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" busy={busy} data-testid="start-create-submit">
          {tv("form.create")}
        </Button>
        <ButtonLink href="/manage" variant="secondary">
          {t("toManage")}
        </ButtonLink>
      </div>
    </form>
  );
}
