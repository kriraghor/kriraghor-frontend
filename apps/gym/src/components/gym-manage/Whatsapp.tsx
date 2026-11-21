"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowSquareOut, ChatCircleText, LinkSimple, PaperPlaneTilt, PencilSimple, WhatsappLogo } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { publicEnv } from "@kriraghor/session/env";
import { cn } from "@kriraghor/ui/cn";
import { newKey } from "@kriraghor/ui/format";
import { Badge, Button, Card, Checkbox, Dialog, ErrorState, Notice, PhoneField, Select, Skeleton, Tabs, Textarea, bdMobile, useConfirm, useToast } from "@kriraghor/ui/kit";
import { AUTO_KINDS, gymWhatsapp, senderOf, type AutoKind, type GymWhatsapp, type MemberWhatsapp as MemberWa, type OwnerWhatsapp, type Sender } from "@/lib/gym-whatsapp";
import { loadFacebookSdk, runEmbeddedSignup } from "@/lib/meta-signup";
import { gymPageUrl, isNumberProblem, numberOrNull } from "@/lib/whatsapp";
import { GymPage, Row, useFmt, type GymCtx } from "./common";
import { SwitchRow, localNumber, useWaError, useWaGym, useWaSending } from "./wa-parts";
import { WaHistoryTab, WaSendTab } from "./WhatsappSend";

export { SwitchRow, localNumber } from "./wa-parts";

/**
 * /manage/[gymId]/whatsapp (M24-FR-157 to FR-170, 21 Nov 2026), three tabs:
 *  - Send and History (the owner and staff with whatsapp.send; plan feature whatsapp): a notice or greeting
 *    to a group of members, and what was sent with its delivery counts;
 *  - Setup (the owner): the chat number for all gyms, this gym's own number and page button, the WhatsApp
 *    Business numbers (Meta embedded sign-up), and the number and automatic messages this gym sends with.
 * Chat numbers work on every plan; sending stays "coming soon" while the platform switch (`apiEnabled`) is off.
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
  const t = useTranslations("gw");
  const waErr = useWaError();
  const q = useWaGym(ctx);
  if (q.isPending) return <Skeleton className="h-64 rounded-card" />;
  if (q.isError || !q.data) return <ErrorState title={waErr(q.error)} onRetry={() => void q.refetch()} />;
  const w = q.data;
  const items = [
    { value: "send", label: t("tabs.send"), testId: "wa-tab-send", content: <WaSendTab ctx={ctx} w={w} /> },
    { value: "history", label: t("tabs.history"), testId: "wa-tab-history", content: <WaHistoryTab ctx={ctx} w={w} /> },
    ...(ctx.owner ? [{ value: "setup", label: t("tabs.setup"), testId: "wa-tab-setup", content: <Setup ctx={ctx} w={w} /> }] : []),
  ];
  return (
    <div className="flex flex-col gap-3">
      {!ctx.owner ? <p className="text-sm text-muted">{t("staffNote")}</p> : null}
      <Tabs label={t("tabs.label")} defaultValue={ctx.owner ? "setup" : "send"} items={items} />
    </div>
  );
}

/** The owner's Setup tab: step 1's chat numbers, then (while sending is on) the Business numbers and this gym's sending. */
function Setup({ ctx, w }: { ctx: GymCtx; w: GymWhatsapp }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <OwnerNumber w={w} />
      <ThisGym ctx={ctx} w={w} />
      <FromPanel apiEnabled={w.apiEnabled} />
      {w.apiEnabled ? <Sending ctx={ctx} w={w} /> : null}
    </div>
  );
}

/** Save or remove, with the confirm first; a bad number shows on the field. */
function useSave() {
  const err = useWaError();
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

// ---------------------------------------------------------------- step 2 setup: Business numbers and this gym's sending

/** GET /manage/whatsapp: the owner's senders and the embedded sign-up settings (while sending is on). */
function Sending({ ctx, w }: { ctx: GymCtx; w: GymWhatsapp }) {
  const waErr = useWaError();
  const q = useQuery({ queryKey: ["gm-wa-owner"], queryFn: () => gymWhatsapp.owner(), retry: false });
  if (q.isPending) return <Skeleton className="h-48 rounded-card lg:col-span-2" />;
  if (q.isError || !q.data)
    return (
      <div className="lg:col-span-2">
        <ErrorState title={waErr(q.error)} onRetry={() => void q.refetch()} />
      </div>
    );
  return (
    <>
      <Senders ow={q.data} />
      <Branch ctx={ctx} w={w} senders={q.data.senders} />
    </>
  );
}

const SENDER_TONE = { connected: "brand", restricted: "warning", disconnected: "neutral" } as const;

/**
 * The owner's WhatsApp Business numbers (M24-FR-160, FR-161): each with its name, status, quality and
 * templates, and Disconnect; Connect opens the embedded sign-up by Meta (the SDK loads on this tab only).
 */
function Senders({ ow }: { ow: OwnerWhatsapp }) {
  const t = useTranslations("gw");
  const f = useFmt();
  const qc = useQueryClient();
  const ask = useConfirm();
  const toast = useToast();
  const waErr = useWaError();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [key, setKey] = useState(newKey);
  const signUp = ow.signUp;
  // Load the SDK early so the popup opens straight from the click (browsers block late popups).
  useEffect(() => {
    if (signUp) loadFacebookSdk(signUp.appId).catch(() => undefined);
  }, [signUp]);
  const saved = async (senders: Sender[]) => {
    qc.setQueryData(["gm-wa-owner"], { ...ow, senders });
    await qc.invalidateQueries({ queryKey: ["gm-wa"] });
  };
  const connect = async () => {
    if (!signUp) return;
    if (!(await ask({ kind: "add", title: t("senders.connectAsk"), body: t("senders.connectBody") }))) return;
    setBusy("connect");
    setProblem(null);
    setNote(t("senders.connecting"));
    try {
      const got = await runEmbeddedSignup(signUp);
      const senders = await gymWhatsapp.connect({ code: got.code, wabaId: got.wabaId, phoneNumberId: got.phoneNumberId }, key);
      setKey(newKey());
      await saved(senders);
      toast.show(t("senders.connected"));
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setProblem(m === "CANCELLED" ? t("senders.cancelled") : m.startsWith("FB_SDK") ? t("senders.sdkFailed") : waErr(e));
    } finally {
      setNote(null);
      setBusy(null);
    }
  };
  const disconnect = async (s: Sender) => {
    if (!(await ask({ kind: "remove", title: t("senders.disconnectAsk", { number: s.displayNumber }), body: t("senders.disconnectBody"), confirmLabel: t("senders.disconnect") }))) return;
    setBusy(s.id);
    setProblem(null);
    try {
      await saved(await gymWhatsapp.disconnect(s.id));
      toast.show(t("senders.disconnected"));
    } catch (e) {
      setProblem(waErr(e));
    } finally {
      setBusy(null);
    }
  };
  const list = ow.senders.filter((s) => s.status !== "disconnected");
  return (
    <Card padded={false} className="flex flex-col gap-3 p-4" data-testid="wa-senders">
      <div>
        <h2 className="font-display text-lg font-bold">{t("senders.title")}</h2>
        <p className="text-sm text-muted">{t("senders.lead")}</p>
      </div>
      {list.length ? (
        <ul className="flex flex-col gap-2">
          {list.map((s) => (
            <li key={s.id} className="rounded-control border border-line p-3 text-sm" data-testid="wa-sender" data-status={s.status}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold tabular-nums">{s.displayNumber}</p>
                  {s.verifiedName ? <p className="text-muted">{s.verifiedName}</p> : null}
                </div>
                <Badge tone={SENDER_TONE[s.status]}>{t(`senders.status.${s.status}`)}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted">
                {[s.quality ? t("senders.quality", { q: s.quality }) : null, s.messagingLimit ? t("senders.limit", { limit: s.messagingLimit }) : null].filter(Boolean).join(" · ")}
              </p>
              <p className="text-xs text-muted">{t("senders.templates", { approved: f.n(s.templates.approved), pending: f.n(s.templates.pending), rejected: f.n(s.templates.rejected) })}</p>
              {!s.creditAttached ? <p className="mt-1 text-xs text-warning">{t("senders.noCredit")}</p> : null}
              <Button type="button" size="sm" variant="ghost" className="mt-1" busy={busy === s.id} onClick={() => void disconnect(s)} data-testid="wa-sender-disconnect">
                {t("senders.disconnect")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t("senders.none")}</p>
      )}
      {signUp ? (
        <>
          <Button type="button" className="self-start" icon={<LinkSimple size={18} aria-hidden />} busy={busy === "connect"} onClick={() => void connect()} data-testid="wa-connect">
            {t("senders.connect")}
          </Button>
          {note ? (
            <p className="text-sm text-muted" aria-live="polite">
              {note}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted" data-testid="wa-connect-soon">
          {t("senders.soon")}
        </p>
      )}
      <p className="text-xs text-muted">{t("senders.coexist")}</p>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
    </Card>
  );
}

/** Which number this gym sends from, and its automatic messages (M24-FR-162, FR-164). */
function Branch({ ctx, w, senders }: { ctx: GymCtx; w: GymWhatsapp; senders: Sender[] }) {
  const t = useTranslations("gw");
  const qc = useQueryClient();
  const ask = useConfirm();
  const toast = useToast();
  const waErr = useWaError();
  const [senderId, setSenderId] = useState(w.senderId ?? "");
  const [auto, setAuto] = useState<AutoKind[]>(w.autoKinds);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const current = senderOf(w);
  const usable = senders.filter((s) => s.status !== "disconnected" || s.id === w.senderId);
  const available = new Set<string>(w.autoKindsAvailable);
  const sameKinds = auto.length === w.autoKinds.length && auto.every((k) => w.autoKinds.includes(k));
  const changed = (senderId || null) !== (w.senderId ?? null) || !sameKinds;
  const toggle = (k: AutoKind, on: boolean) => setAuto(AUTO_KINDS.filter((x) => (x === k ? on : auto.includes(x))));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changed) return;
    if (!(await ask({ kind: "save", title: t("branch.saveAsk") }))) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await gymWhatsapp.setGym(ctx.gymId, { senderId: senderId || null, autoKinds: auto });
      qc.setQueryData(["gm-wa", ctx.gymId], r);
      setSenderId(r.senderId ?? "");
      setAuto(r.autoKinds);
      toast.show(t("saved"));
    } catch (e2) {
      setProblem(waErr(e2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card padded={false} className="p-4" data-testid="wa-branch">
      <form onSubmit={save} className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">{t("branch.title")}</h2>
        {usable.length ? (
          <Select id="wa-branch-sender" label={t("branch.sender")} value={senderId} onChange={(e) => setSenderId(e.target.value)} data-testid="wa-branch-sender">
            <option value="">{t("branch.noSender")}</option>
            {usable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.verifiedName ? `${s.displayNumber} · ${s.verifiedName}` : s.displayNumber}
              </option>
            ))}
          </Select>
        ) : (
          <p className="text-sm text-muted">{t("branch.needSender")}</p>
        )}
        {current && current.status !== "connected" ? <p className="text-xs text-warning">{t(`senders.status.${current.status}`)}</p> : null}
        <div>
          <p className="font-semibold">{t("branch.auto")}</p>
          <p className="text-xs text-muted">{t("branch.autoHint")}</p>
        </div>
        <div className="flex flex-col gap-1" data-testid="wa-auto">
          {AUTO_KINDS.map((k) => (
            <SwitchRow key={k} id={`wa-auto-${k}`} label={t(`branch.kind.${k}`)} hint={available.has(k) ? undefined : t("branch.notOnPlan")} on={auto.includes(k)} disabled={!available.has(k) && !auto.includes(k)} onChange={(on) => toggle(k, on)} testId={`wa-auto-${k}`} />
          ))}
        </div>
        {problem ? <Notice tone="error">{problem}</Notice> : null}
        <Button type="submit" className="self-start" busy={busy} disabled={!changed} data-testid="wa-branch-save">
          {t("save")}
        </Button>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------- the member profile card (M24-FR-159)

/**
 * A member's WhatsApp choices on their profile: receipts and reminders, news and offers, and the last
 * digits of the number (members.view). Staff who can edit members change them, only with the member's
 * word ("The member agreed"); a member who never answered agreed to neither. While sending is on, staff
 * with whatsapp.send also send one message and see the member's WhatsApp messages (M24-FR-168, FR-170).
 */
export function MemberWhatsappCard({ ctx, memberId, name, canEdit }: { ctx: GymCtx; memberId: string; name: string; canEdit: boolean }) {
  const t = useTranslations("gw");
  const f = useFmt();
  const err = useWaError();
  const on = ctx.can("members.view");
  const sending = useWaSending(ctx);
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
          {sending ? <MemberSending ctx={ctx} memberId={memberId} name={name} /> : null}
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

const MSG_TONE = { queued: "neutral", sending: "neutral", sent: "info", delivered: "brand", read: "brand", failed: "danger", expired: "warning" } as const;

/** Send one member a WhatsApp update, and their messages from the gym (M24-FR-168, FR-170): whatsapp.send, sending on. */
function MemberSending({ ctx, memberId, name }: { ctx: GymCtx; memberId: string; name: string }) {
  const t = useTranslations("gw");
  const f = useFmt();
  const waErr = useWaError();
  const [writing, setWriting] = useState(false);
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["gm-member-wa-messages", ctx.gymId, memberId], queryFn: () => gymWhatsapp.messages(ctx.gymId, memberId), enabled: open, retry: false });
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" icon={<PaperPlaneTilt size={16} aria-hidden />} onClick={() => setWriting(true)} data-testid="wa-member-send">
          {t("memberSend.send")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(!open)} aria-expanded={open} data-testid="wa-member-messages-toggle">
          {open ? t("memberSend.hideMessages") : t("memberSend.messages")}
        </Button>
      </div>
      {open ? (
        q.isPending ? (
          <Skeleton className="h-16 rounded-card" />
        ) : q.isError || !q.data ? (
          <p role="alert" className="text-sm text-danger">
            {waErr(q.error)}
          </p>
        ) : !q.data.items.length ? (
          <p className="text-sm text-muted">{t("memberSend.none")}</p>
        ) : (
          <ul className="divide-y divide-line text-sm" data-testid="wa-member-messages">
            {q.data.items.map((m) => (
              <li key={m.id} className="flex flex-col gap-0.5 py-2">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted">
                    {t(`memberSend.kind.${m.kind}`)} · {m.createdAt ? `${f.short(m.createdAt)} ${f.time(m.createdAt)}` : "–"}
                  </span>
                  <Badge tone={MSG_TONE[m.status]}>{t(`memberSend.status.${m.status}`)}</Badge>
                </span>
                <span className="line-clamp-3 whitespace-pre-line">{m.text}</span>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {writing ? <SingleSend ctx={ctx} memberId={memberId} name={name} onClose={() => setWriting(false)} /> : null}
    </div>
  );
}

const SINGLE_MAX = 500;

function SingleSend({ ctx, memberId, name, onClose }: { ctx: GymCtx; memberId: string; name: string; onClose: () => void }) {
  const t = useTranslations("gw");
  const f = useFmt();
  const qc = useQueryClient();
  const ask = useConfirm();
  const toast = useToast();
  const waErr = useWaError();
  const [message, setMessage] = useState("");
  const [key] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const send = async () => {
    if (!message.trim()) return setProblem(t("send.writeMessage"));
    if (!(await ask({ kind: "send", title: t("memberSend.ask", { name }) }))) return;
    setBusy(true);
    setProblem(null);
    try {
      await gymWhatsapp.send(ctx.gymId, { kind: "single", memberId, message: message.trim() }, key);
      await qc.invalidateQueries({ queryKey: ["gm-member-wa-messages", ctx.gymId, memberId] });
      toast.show(t("memberSend.sent"));
      onClose();
    } catch (e) {
      setProblem(waErr(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("memberSend.title", { name })}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" busy={busy} icon={<PaperPlaneTilt size={16} aria-hidden />} onClick={() => void send()} data-testid="wa-single-send">
            {t("memberSend.send")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2" data-testid="wa-single-dialog">
        <Textarea id="wa-single" label={t("memberSend.label")} value={message} maxLength={SINGLE_MAX} onChange={(e) => setMessage(e.target.value)} hint={`${t("memberSend.hint")} ${t("send.count", { n: f.n(message.length), max: f.n(SINGLE_MAX) })}`} data-testid="wa-single-message" />
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
