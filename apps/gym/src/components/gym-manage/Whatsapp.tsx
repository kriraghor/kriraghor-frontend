"use client";

import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowSquareOut, ChatCircleText, PencilSimple, WhatsappLogo } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { publicEnv } from "@kriraghor/session/env";
import { cn } from "@kriraghor/ui/cn";
import { Badge, Button, Card, Checkbox, Dialog, ErrorState, Notice, PhoneField, Skeleton, bdMobile, useConfirm, useToast } from "@kriraghor/ui/kit";
import { gymWhatsapp, type GymWhatsapp, type MemberWhatsapp as MemberWa } from "@/lib/gym-whatsapp";
import { gymPageUrl, isNumberProblem, numberOrNull } from "@/lib/whatsapp";
import { GymPage, Row, useFmt, useGymError, type GymCtx } from "./common";

/** An E.164 number (+8801…) in the local form people read and type (01…); empty for none. */
export const localNumber = (n: string | null | undefined) => (n ? bdMobile.local(n) : "");

/**
 * An on/off switch with its label and a one-line explanation: a button with role switch, 44px tall,
 * the label clickable too (the Reminders switch with words beside it).
 */
export function SwitchRow({ id, label, hint, on, onChange, disabled, testId }: { id: string; label: ReactNode; hint?: ReactNode; on: boolean; onChange: (on: boolean) => void; disabled?: boolean; testId?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-[15px] font-semibold">
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className="text-xs text-muted">
            {hint}
          </p>
        ) : null}
      </div>
      <button type="button" role="switch" id={id} aria-checked={on} aria-describedby={hint ? `${id}-hint` : undefined} disabled={disabled} onClick={() => onChange(!on)} className="inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-60" data-testid={testId} data-on={on}>
        <span className={cn("relative inline-flex h-7 w-12 items-center rounded-full border transition-colors", on ? "border-brand bg-brand" : "border-line-strong bg-surface-2")}>
          <span className={cn("absolute size-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-6" : "translate-x-1")} />
        </span>
      </button>
    </div>
  );
}

/**
 * /manage/[gymId]/whatsapp (owner; M24-FR-157, FR-158, step 1 of WhatsApp for gyms, 21 Nov 2026): the chat
 * number for all the owner's gyms, this gym's own number and whether its page shows the button, which
 * number the page shows now, and "Messages from the panel" (coming soon while `apiEnabled` is off). Every
 * plan has chat numbers, so no feature gate.
 */
export function WhatsappPage({ gymId }: { gymId: string }) {
  const t = useTranslations("gw");
  return (
    <GymPage gymId={gymId} page="whatsapp" title={t("title")} description={t("lead")} testId="gm-whatsapp">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

function Body({ ctx }: { ctx: GymCtx }) {
  const err = useGymError();
  const q = useQuery({ queryKey: ["gm-wa", ctx.gymId], queryFn: () => gymWhatsapp.gym(ctx.gymId), retry: false });
  if (q.isPending) return <Skeleton className="h-64 rounded-card" />;
  if (q.isError || !q.data) return <ErrorState title={err(q.error)} onRetry={() => void q.refetch()} />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <OwnerNumber w={q.data} />
      <ThisGym ctx={ctx} w={q.data} />
      <FromPanel apiEnabled={q.data.apiEnabled} />
    </div>
  );
}

/** Save or remove, with the confirm first; a bad number shows on the field. */
function useSave() {
  const err = useGymError();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [numberBad, setNumberBad] = useState(false);
  /** The answer, or null when it failed (the problem is shown). */
  const run = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setProblem(null);
    setNumberBad(false);
    try {
      return await fn();
    } catch (e) {
      if (isNumberProblem(problemOf(e))) setNumberBad(true);
      else setProblem(err(e));
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { busy, problem, numberBad, setNumberBad, run };
}

function OwnerNumber({ w }: { w: GymWhatsapp }) {
  const t = useTranslations("gw");
  const qc = useQueryClient();
  const toast = useToast();
  const ask = useConfirm();
  const s = useSave();
  const current = localNumber(w.ownerNumber);
  const [value, setValue] = useState(current);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const number = numberOrNull(value);
    if (!number || !bdMobile.valid(number)) return s.setNumberBad(true);
    if (!(await ask({ kind: "save", title: t("owner.saveAsk"), body: t("owner.saveBody", { number: bdMobile.local(number) }) }))) return;
    if (await s.run(() => gymWhatsapp.setOwnerNumber(number))) {
      await qc.invalidateQueries({ queryKey: ["gm-wa"] });
      toast.show(t("saved"));
    }
  };
  const remove = async () => {
    if (!(await ask({ kind: "remove", title: t("owner.removeAsk"), body: t("owner.removeBody") }))) return;
    if (await s.run(() => gymWhatsapp.setOwnerNumber(null))) {
      setValue("");
      await qc.invalidateQueries({ queryKey: ["gm-wa"] });
      toast.show(t("owner.removed"));
    }
  };
  return (
    <Card padded={false} className="p-4" data-testid="wa-owner">
      <form onSubmit={save} className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">{t("owner.title")}</h2>
          <p className="text-sm text-muted">{t("owner.body")}</p>
        </div>
        <PhoneField id="wa-owner-number" label={t("owner.label")} value={value} onChange={(v) => { setValue(v); s.setNumberBad(false); }} placeholder="01XXXXXXXXX" error={s.numberBad ? t("numberBad") : undefined} data-testid="wa-owner-number" />
        <p className="text-sm text-muted" data-testid="wa-owner-current">
          {current ? t("owner.current", { number: current }) : t("owner.none")}
        </p>
        {s.problem ? <Notice tone="error">{s.problem}</Notice> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" busy={s.busy} disabled={bdMobile.local(value) === current} data-testid="wa-owner-save">
            {t("save")}
          </Button>
          {w.ownerNumber ? (
            <Button type="button" variant="ghost" busy={s.busy} onClick={() => void remove()} data-testid="wa-owner-remove">
              {t("remove")}
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

function ThisGym({ ctx, w }: { ctx: GymCtx; w: GymWhatsapp }) {
  const t = useTranslations("gw");
  const qc = useQueryClient();
  const toast = useToast();
  const ask = useConfirm();
  const s = useSave();
  const [number, setNumber] = useState(localNumber(w.number));
  const [show, setShow] = useState(w.showOnPage);
  const numberChanged = bdMobile.local(number) !== localNumber(w.number);
  const changed = numberChanged || show !== w.showOnPage;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const typed = numberOrNull(number);
    if (typed && !bdMobile.valid(typed)) return s.setNumberBad(true);
    const body: { number?: string | null; showOnPage?: boolean } = {};
    if (numberChanged) body.number = typed;
    if (show !== w.showOnPage) body.showOnPage = show;
    if (!Object.keys(body).length) return;
    if (!(await ask({ kind: "save", title: t("gym.saveAsk") }))) return;
    const saved = await s.run(() => gymWhatsapp.setGym(ctx.gymId, body));
    if (saved) {
      qc.setQueryData(["gm-wa", ctx.gymId], saved);
      setNumber(localNumber(saved.number));
      setShow(saved.showOnPage);
      toast.show(t("saved"));
    }
  };
  const pageUrl = gymPageUrl(publicEnv().GYM_URL, ctx.gym.slug);
  return (
    <Card padded={false} className="p-4" data-testid="wa-gym">
      <form onSubmit={save} className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">{t("gym.title")}</h2>
        <PhoneField id="wa-gym-number" label={t("gym.label")} value={number} onChange={(v) => { setNumber(v); s.setNumberBad(false); }} placeholder={localNumber(w.ownerNumber) || "01XXXXXXXXX"} hint={t("gym.hint")} error={s.numberBad ? t("numberBad") : undefined} data-testid="wa-gym-number" />
        <SwitchRow id="wa-gym-show" label={t("gym.show")} hint={t("gym.showHint")} on={show} onChange={setShow} testId="wa-gym-show" />
        <div className="rounded-control border border-line bg-surface-2/60 p-3 text-sm" data-testid="wa-shown" data-source={w.source}>
          <p className="flex items-start gap-2">
            <WhatsappLogo size={18} className={cn("mt-0.5 shrink-0", w.shown ? "text-brand-text" : "text-muted")} aria-hidden />
            <span>{w.shown ? t(w.source === "own" ? "gym.shownOwn" : "gym.shownOwner", { number: localNumber(w.shown) }) : t("gym.shownNone")}</span>
          </p>
          {!w.number && !w.ownerNumber ? <p className="mt-1 text-xs text-muted">{t("gym.noNumber")}</p> : null}
          <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-text underline" data-testid="wa-open-page">
            {t("gym.openPage")} <ArrowSquareOut size={16} aria-hidden />
          </a>
        </div>
        {s.problem ? <Notice tone="error">{s.problem}</Notice> : null}
        <Button type="submit" className="self-start" busy={s.busy} disabled={!changed} data-testid="wa-gym-save">
          {t("save")}
        </Button>
      </form>
    </Card>
  );
}

/** Step 2 (sending through Meta's API) is switched off: say it is coming, with no buttons. */
function FromPanel({ apiEnabled }: { apiEnabled: boolean }) {
  const t = useTranslations("gw");
  return (
    <Card padded={false} className={cn("flex gap-3 p-4 lg:col-span-2", !apiEnabled && "border-dashed")} data-testid="wa-api" data-state={apiEnabled ? "on" : "soon"}>
      <ChatCircleText size={24} className="shrink-0 text-muted" aria-hidden />
      <div>
        <p className="font-semibold">{t("api.title")}</p>
        <p className="text-sm text-muted">{apiEnabled ? t("api.on") : t("api.soon")}</p>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- the member profile card (M24-FR-159)

/**
 * A member's WhatsApp choices on their profile: receipts and reminders, news and offers, and the last
 * digits of the number (members.view). Staff who can edit members change them, only with the member's
 * word ("The member agreed"); a member who never answered agreed to neither.
 */
export function MemberWhatsappCard({ ctx, memberId, name, canEdit }: { ctx: GymCtx; memberId: string; name: string; canEdit: boolean }) {
  const t = useTranslations("gw");
  const f = useFmt();
  const err = useGymError();
  const on = ctx.can("members.view");
  const q = useQuery({ queryKey: ["gm-member-wa", ctx.gymId, memberId], queryFn: () => gymWhatsapp.member(ctx.gymId, memberId), enabled: on, retry: false });
  const [editing, setEditing] = useState(false);
  if (!on) return null;
  const w = q.data;
  const yesNo = (v: boolean) => <Badge tone={v ? "brand" : "neutral"}>{v ? t("consent.yes") : t("consent.no")}</Badge>;
  return (
    <Card padded={false} className="p-4" data-testid="profile-whatsapp">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <WhatsappLogo size={20} aria-hidden /> {t("member.title")}
        </h2>
        {canEdit && w ? (
          <Button type="button" size="sm" variant="secondary" icon={<PencilSimple size={16} aria-hidden />} onClick={() => setEditing(true)} data-testid="wa-member-edit">
            {t("member.edit")}
          </Button>
        ) : null}
      </div>
      {q.isPending ? (
        <Skeleton className="h-24 rounded-card" />
      ) : q.isError || !w ? (
        <p role="alert" className="text-sm text-danger">
          {err(q.error)}
        </p>
      ) : (
        <>
          <div className="divide-y divide-line">
            <Row label={t("consent.service")}>
              <span data-testid="wa-member-service">{yesNo(w.service)}</span>
            </Row>
            <Row label={t("consent.news")}>
              <span data-testid="wa-member-news">{yesNo(w.news)}</span>
            </Row>
            <Row label={t("member.number")}>
              <span data-testid="wa-member-last4">{w.numberLast4 ? `•••• ${w.numberLast4}` : t("member.notGiven")}</span>
            </Row>
          </div>
          <p className="mt-2 text-xs text-muted">{w.source ? t("member.at", { source: t(`member.source.${w.source}`), date: f.date(w.at) }) : t("member.never")}</p>
          {editing ? <MemberEdit ctx={ctx} memberId={memberId} name={name} w={w} onClose={() => setEditing(false)} /> : null}
        </>
      )}
    </Card>
  );
}

function MemberEdit({ ctx, memberId, name, w, onClose }: { ctx: GymCtx; memberId: string; name: string; w: MemberWa; onClose: () => void }) {
  const t = useTranslations("gw");
  const qc = useQueryClient();
  const toast = useToast();
  const ask = useConfirm();
  const s = useSave();
  const [d, setD] = useState({ number: "", service: w.service, news: w.news, agreed: false });
  const [needAgree, setNeedAgree] = useState(false);
  const save = async () => {
    const number = numberOrNull(d.number);
    if (number && !bdMobile.valid(number)) return s.setNumberBad(true);
    if (!d.agreed) return setNeedAgree(true);
    if (!(await ask("save"))) return;
    const saved = await s.run(() => gymWhatsapp.setMember(ctx.gymId, memberId, { number, service: d.service, news: d.news }));
    if (saved) {
      qc.setQueryData(["gm-member-wa", ctx.gymId, memberId], saved);
      toast.show(t("saved"));
      onClose();
    }
  };
  const hint = w.phoneLast4 ? t("member.numberHint", { last4: w.phoneLast4 }) : t("member.numberHintNoPhone");
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("member.editTitle", { name })}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={() => void save()} busy={s.busy} data-testid="wa-member-save">
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-testid="wa-member-dialog">
        <PhoneField
          id="wa-m-number"
          label={t("member.numberLabel")}
          value={d.number}
          onChange={(v) => {
            setD({ ...d, number: v });
            s.setNumberBad(false);
          }}
          placeholder={w.phoneLast4 ? t("member.samePhone", { last4: w.phoneLast4 }) : "01XXXXXXXXX"}
          hint={w.numberLast4 && w.numberLast4 !== w.phoneLast4 ? `${t("member.now", { last4: w.numberLast4 })} ${hint}` : hint}
          error={s.numberBad ? t("numberBad") : undefined}
          data-testid="wa-member-number"
        />
        <SwitchRow id="wa-m-service" label={t("consent.service")} hint={t("consent.serviceHint")} on={d.service} onChange={(v) => setD({ ...d, service: v })} testId="wa-member-service-switch" />
        <SwitchRow id="wa-m-news" label={t("consent.news")} hint={t("consent.newsHint")} on={d.news} onChange={(v) => setD({ ...d, news: v })} testId="wa-member-news-switch" />
        <Checkbox
          id="wa-m-agreed"
          label={t("member.agreed")}
          checked={d.agreed}
          required
          aria-invalid={needAgree && !d.agreed}
          onChange={(e) => {
            setD({ ...d, agreed: e.target.checked });
            setNeedAgree(false);
          }}
          data-testid="wa-member-agreed"
        />
        {needAgree && !d.agreed ? (
          <p role="alert" className="text-sm text-danger">
            {t("member.agreedNeeded")}
          </p>
        ) : null}
        {s.problem ? (
          <p role="alert" className="text-sm text-danger">
            {s.problem}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
