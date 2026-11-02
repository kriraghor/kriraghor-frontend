"use client";

import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { ArrowLeft, CaretLeft, CaretRight, MagnifyingGlass } from "@phosphor-icons/react";
import { Avatar, Badge, Button, IconButton, Notice, ReasonDialog, Skeleton } from "@kriraghor/ui/kit";
import { problemOf } from "@kriraghor/api-client";
import { cn } from "@kriraghor/ui/cn";
import { DatePicker } from "@kriraghor/ui/date";
import { DeskAccessNotice, inputCls, useDeskErrorText } from "@kriraghor/ui/desk";
import { cleanCode, gymDesk, nextDays, scanInput, shiftDay, type Admission } from "@/lib/manage";
import { DECISION_TONE, deskAction, deskInput, featureLocked, gymManage, type DeskCard, type DeskPass } from "@/lib/gym-manage";
import { Upsell, useFmt, useGymCtx, useGymError } from "@/components/gym-manage/common";
import { canScan, useQrScanner } from "@/components/QrScanner";

type PassResult = { ok: true; a: Admission } | { ok: false; code: string; title: string; at?: string; validFrom?: string; validTo?: string };
type MemberResult = { ok: true; card: DeskCard } | { ok: false; code: string; title: string; reasons: string[]; canOverride: boolean; body: { memberId: string } | { token: string }; name?: string };
/**
 * /manage/[gymId]/desk (M20 §5, M24-FR-47 to FR-50): the front desk. With attendance.mark (and the
 * owner): one search box for a name, phone, member code or pass code; a member's card shows the
 * status flags and the entry decision (amber warn, red block with the owner's override and a reason)
 * with **Check in**; a pass shows **Admit** (the M20 flow). The camera reads a member's rotating QR
 * (checks in) or a pass QR (admits). The search box keeps focus after each check-in; today's
 * check-ins and admissions follow. Staff with only desk.admit keep the pass code entry.
 */
export function FrontDesk({ id }: { id: string }) {
  const t = useTranslations("vendorGym");
  const tg = useTranslations("gm");
  const f = useFmt();
  const qc = useQueryClient();
  const errorText = useDeskErrorText();
  const gymErr = useGymError();
  const { q: gyms, ctx } = useGymCtx(id);
  const perms = ctx?.perms ?? null;
  const has = (p: string) => perms === null || perms.includes(p);
  const canCheckIn = Boolean(ctx) && has("attendance.mark");
  const canAdmit = Boolean(ctx) && has("desk.admit");
  const canList = Boolean(ctx) && has("desk.admissions");
  const attendanceLocked = ctx ? featureLocked(ctx.gym.features, "attendance") : false;
  const [todayDate] = useState(() => nextDays(1)[0]);
  const [listDate, setListDate] = useState(todayDate);
  const isToday = listDate === todayDate;
  const admissions = useQuery({
    queryKey: ["gym-admissions", id, listDate],
    queryFn: () => gymDesk.admissions(id, isToday ? undefined : listDate),
    refetchInterval: isToday ? 30_000 : false,
    enabled: canList,
  });
  const checkins = useQuery({ queryKey: ["gm-checkins", id, listDate], queryFn: () => gymManage.checkins(id, isToday ? undefined : listDate), refetchInterval: isToday ? 30_000 : false, enabled: canCheckIn });

  const [text, setText] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [found, setFound] = useState<{ items: DeskCard[]; pass: DeskPass | null; q: string } | null>(null);
  const [passResult, setPassResult] = useState<PassResult | null>(null);
  const [memberResult, setMemberResult] = useState<MemberResult | null>(null);
  const [overriding, setOverriding] = useState<{ body: { memberId: string } | { token: string }; name?: string } | null>(null);
  const [overrideProblem, setOverrideProblem] = useState<string | null>(null);
  const [camera, setCamera] = useState<"off" | "on" | "unsupported" | "denied">("off");
  const input = useRef<HTMLInputElement>(null);
  const focus = () => setTimeout(() => input.current?.focus(), 0);
  const isNetwork = (err: unknown) => err instanceof TypeError || (err as { name?: string })?.name === "TypeError";

  const admit = useCallback(
    async (inp: { token: string } | { code: string }) => {
      setBusy(true);
      setMemberResult(null);
      try {
        const a = await gymDesk.redeem(id, inp);
        setPassResult({ ok: true, a });
        setCode("");
        setText("");
        setFound(null);
        setOffline(false);
        setListDate(todayDate);
        await qc.invalidateQueries({ queryKey: ["gym-admissions", id] });
      } catch (err) {
        if (isNetwork(err)) setOffline(true);
        // The API spreads the problem meta on the body: `at` (the earlier admission), validFrom and validTo.
        const p = problemOf(err) as (ReturnType<typeof problemOf> & { at?: string; validFrom?: string; validTo?: string }) | null;
        setPassResult({ ok: false, code: p?.code ?? "UNKNOWN", title: errorText(err, t("failed")) ?? t("failed"), at: p?.at, validFrom: p?.validFrom, validTo: p?.validTo });
      } finally {
        setBusy(false);
        focus();
      }
    },
    [id, qc, t, todayDate, errorText],
  );

  const checkIn = useCallback(
    async (body: { memberId: string } | { token: string }, name?: string, override?: { reason: string }) => {
      setBusy(true);
      setPassResult(null);
      try {
        const card = await gymManage.checkIn(id, body, override);
        setMemberResult({ ok: true, card });
        setText("");
        setFound(null);
        setOffline(false);
        setOverriding(null);
        setListDate(todayDate);
        await qc.invalidateQueries({ queryKey: ["gm-checkins", id] });
        await qc.invalidateQueries({ queryKey: ["gm-overview", id] });
        return true;
      } catch (err) {
        if (isNetwork(err)) setOffline(true);
        const p = problemOf(err) as (ReturnType<typeof problemOf> & { reasons?: string[]; canOverride?: boolean }) | null;
        if (override) {
          setOverrideProblem(gymErr(err));
          return false;
        }
        setMemberResult({ ok: false, code: p?.code ?? "UNKNOWN", title: gymErr(err), reasons: p?.reasons ?? [], canOverride: Boolean(p?.canOverride), body, name });
        return false;
      } finally {
        setBusy(false);
        focus();
      }
    },
    [id, qc, todayDate, gymErr],
  );

  const submitText = useCallback(
    async (value: string) => {
      const d = deskInput(value);
      if (d.kind === "empty") return;
      if (d.kind === "member") return void checkIn({ token: d.token });
      if (d.kind === "pass") return void (canAdmit ? admit({ token: d.token }) : undefined);
      setBusy(true);
      setPassResult(null);
      setMemberResult(null);
      try {
        const r = await gymManage.search(id, d.q);
        setFound({ items: r.items, pass: r.pass, q: d.q });
        setOffline(false);
      } catch (err) {
        if (isNetwork(err)) setOffline(true);
        setMemberResult({ ok: false, code: problemOf(err)?.code ?? "UNKNOWN", title: gymErr(err), reasons: [], canOverride: false, body: { memberId: "" } });
      } finally {
        setBusy(false);
      }
    },
    [admit, canAdmit, checkIn, gymErr, id],
  );

  // The camera loop (components/QrScanner): one scan, one request.
  const onScan = useCallback(
    (value: string) => {
      const d = deskInput(value);
      if (d.kind === "member" && canCheckIn) void checkIn({ token: d.token });
      else if (canAdmit) void admit(scanInput(value));
    },
    [admit, checkIn, canAdmit, canCheckIn],
  );
  const onDenied = useCallback(() => setCamera("denied"), []);
  const video = useQrScanner({ on: camera === "on", onValue: onScan, onDenied });

  const startCamera = () => setCamera(canScan() ? "on" : "unsupported");
  const ready = cleanCode(code).length === 6;
  const backHref = ctx ? `/manage/${id}` : "/manage";

  if (gyms.isPending) return <Skeleton className="mx-auto mt-8 h-64 max-w-[1100px] rounded-card" />;

  return (
    <section className="mx-auto w-full max-w-[1100px] px-4 py-5 sm:px-6 md:py-8" data-testid="front-desk">
      <Link href={backHref} className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline">
        <ArrowLeft size={16} aria-hidden />
        {ctx?.gym.name ?? t("title")}
      </Link>
      <h1 className="mt-1 font-display text-2xl font-extrabold md:text-3xl">{t("desk.title")}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{canCheckIn ? tg("desk.lead") : t("desk.lead")}</p>

      {!ctx ? <Notice tone="warning" className="mt-4" title={tg("noGym.title")}>{tg("noGym.body")}</Notice> : null}
      {ctx && !canCheckIn && !canAdmit ? <DeskAccessNotice code="PERMISSION_REQUIRED" className="mt-4" /> : null}
      {offline ? (
        <Notice tone="error" className="mt-4" title={tg("desk.offline")}>
          {tg("desk.offlineBody")}
        </Notice>
      ) : null}
      {canCheckIn && attendanceLocked ? <Upsell feature="attendance" owner={Boolean(ctx?.owner)} className="mt-4" /> : null}

      {canCheckIn || canAdmit ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            {canCheckIn ? (
              <form
                className="surface-card p-3 sm:p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitText(text);
                }}
                data-testid="desk-search-form"
              >
                <label htmlFor="desk-search" className="text-sm font-semibold text-muted">
                  {tg("desk.searchLabel")}
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="desk-search"
                    ref={input}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    enterKeyHint="search"
                    placeholder={tg("desk.searchHint")}
                    className={`${inputCls} min-w-0 flex-1 text-lg`}
                    data-testid="desk-search"
                  />
                  <Button type="submit" busy={busy} icon={<MagnifyingGlass size={18} aria-hidden />} data-testid="desk-search-go">
                    <span className="sr-only sm:not-sr-only">{tg("desk.find")}</span>
                  </Button>
                </div>
              </form>
            ) : (
              <form
                className="surface-card p-3 sm:p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (ready) void admit({ code: cleanCode(code) });
                }}
                data-testid="desk-code-form"
              >
                <label htmlFor="desk-code" className="text-sm font-semibold text-muted">
                  {t("desk.codeLabel")}
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="desk-code"
                    ref={input}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={9}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className={`${inputCls} min-w-0 flex-1 font-mono text-2xl tracking-[0.3em]`}
                    data-testid="desk-code"
                  />
                  <button type="submit" disabled={!ready || busy} className="min-h-12 bg-brand px-5 font-bold text-on-brand disabled:opacity-50" data-testid="desk-admit">
                    {t("desk.admit")}
                  </button>
                </div>
              </form>
            )}
            <div className="surface-card p-3 sm:p-4">
              {camera === "on" ? (
                <>
                  <video ref={video} muted playsInline className="aspect-video w-full rounded-control bg-black object-cover" />
                  <Button type="button" variant="secondary" onClick={() => setCamera("off")} className="mt-3">
                    {t("desk.stopCamera")}
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="secondary" onClick={startCamera} data-testid="desk-camera">
                    {t("desk.scan")}
                  </Button>
                  {camera === "unsupported" ? <p className="mt-2 text-sm text-muted">{t("desk.noCamera")}</p> : null}
                  {camera === "denied" ? <p className="mt-2 text-sm text-danger">{t("desk.cameraDenied")}</p> : null}
                </>
              )}
            </div>
          </div>

          <div aria-live="polite" className="flex flex-col gap-3" data-testid="desk-result">
            {memberResult?.ok ? <CheckedIn card={memberResult.card} /> : null}
            {memberResult && !memberResult.ok ? (
              <div className="rounded-card border-4 border-danger p-4" role="alert" data-testid="desk-blocked">
                <p className="text-sm font-bold uppercase tracking-wide text-danger">{memberResult.code === "GYM_ENTRY_BLOCKED" ? tg("desk.blocked") : tg("desk.notCheckedIn")}</p>
                {memberResult.name ? <p className="mt-1 text-xl font-extrabold">{memberResult.name}</p> : null}
                <p className="mt-1 font-semibold">{memberResult.reasons.length ? memberResult.reasons.map((r) => tg(`reason.${r}`)).join(" · ") : memberResult.title}</p>
                {memberResult.canOverride ? (
                  <Button type="button" variant="danger" className="mt-3" onClick={() => (setOverrideProblem(null), setOverriding({ body: memberResult.body, name: memberResult.name }))} data-testid="desk-override">
                    {tg("desk.override")}
                  </Button>
                ) : memberResult.code === "GYM_ENTRY_BLOCKED" ? (
                  <p className="mt-2 text-sm text-muted">{tg("desk.ownerOnly")}</p>
                ) : null}
              </div>
            ) : null}
            {passResult?.ok ? (
              <div className="rounded-card border-4 border-brand bg-brand/10 p-4" data-testid="desk-admitted">
                <p className="text-sm font-bold uppercase tracking-wide text-brand-text">{t("desk.admitted")}</p>
                <p className="mt-1 text-2xl font-extrabold">{passResult.a.holder.displayName ?? t("desk.member")}</p>
                <p className="mt-1 font-semibold">
                  {passResult.a.title} · {passResult.a.passCode}
                </p>
                <p className="text-sm text-muted">{passResult.a.validFrom === passResult.a.validTo ? f.short(passResult.a.validFrom) : `${f.short(passResult.a.validFrom)} – ${f.short(passResult.a.validTo)}`}</p>
                <p className="mt-1 text-sm text-muted">{t("desk.at", { time: f.time(passResult.a.redeemedAt) })}</p>
              </div>
            ) : passResult ? (
              <div className="rounded-card border-4 border-danger p-4" role="alert" data-testid="desk-refused">
                <p className="text-sm font-bold uppercase tracking-wide text-danger">{t("desk.refused")}</p>
                <p className="mt-1 text-xl font-extrabold">
                  {passResult.code === "PASS_ALREADY_REDEEMED" && passResult.at
                    ? t("desk.usedAt", { time: f.time(passResult.at) })
                    : passResult.code === "PASS_NOT_VALID_TODAY" && passResult.validFrom
                      ? t("desk.validOn", { from: f.short(passResult.validFrom), to: f.short(passResult.validTo) })
                      : t.has(`desk.err.${passResult.code}`)
                        ? t(`desk.err.${passResult.code}`)
                        : passResult.title}
                </p>
              </div>
            ) : null}
            {found ? (
              <div className="flex flex-col gap-2" data-testid="desk-found">
                {found.items.map((c) => (
                  <MemberCard key={c.member.id} card={c} busy={busy} locked={attendanceLocked} onCheckIn={() => void checkIn({ memberId: c.member.id }, c.member.displayName)} onOverride={() => (setOverrideProblem(null), setOverriding({ body: { memberId: c.member.id }, name: c.member.displayName }))} gymId={id} />
                ))}
                {found.pass ? <PassCard pass={found.pass} canAdmit={canAdmit} busy={busy} onAdmit={() => void admit(scanInput(found.q))} /> : null}
                {!found.items.length && !found.pass ? <p className="rounded-card border-2 border-dashed border-line p-6 text-center text-muted" data-testid="desk-none">{tg("desk.noMatch", { q: found.q })}</p> : null}
              </div>
            ) : null}
            {!found && !memberResult && !passResult ? <p className="rounded-card border-2 border-dashed border-line p-6 text-center text-muted">{canCheckIn ? tg("desk.waiting") : t("desk.waiting")}</p> : null}
          </div>
        </div>
      ) : null}

      {canCheckIn || canList ? (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-extrabold">{isToday ? tg("desk.todayTitle") : tg("desk.dayTitle", { date: f.short(listDate) })}</h2>
            <div className="flex items-center gap-1.5" data-testid="desk-date">
              <IconButton label={t("desk.prevDay")} variant="secondary" onClick={() => setListDate(shiftDay(listDate, -1))} data-testid="desk-prev-day">
                <CaretLeft size={18} aria-hidden />
              </IconButton>
              <DatePicker id="desk-date-input" label={t("desk.date")} labelHidden value={listDate} max={todayDate} clearable={false} onChange={(v) => v && setListDate(v)} triggerClassName="w-auto min-w-48" testId="desk-date-input" />
              <IconButton label={t("desk.nextDay")} variant="secondary" onClick={() => setListDate(shiftDay(listDate, 1))} disabled={isToday} data-testid="desk-next-day">
                <CaretRight size={18} aria-hidden />
              </IconButton>
              <Button type="button" variant="ghost" onClick={() => setListDate(todayDate)} disabled={isToday} data-testid="desk-to-today">
                {t("desk.todayButton")}
              </Button>
            </div>
          </div>
          <div className="mt-3 grid gap-6 lg:grid-cols-2">
            {canCheckIn ? (
              <div>
                <h3 className="font-semibold">{tg("desk.checkins", { n: checkins.data?.counted ?? 0 })}</h3>
                {checkins.isError ? <Notice tone="error">{gymErr(checkins.error)}</Notice> : null}
                {checkins.data && !checkins.data.items.length ? <p className="mt-2 text-sm text-muted">{tg("desk.noCheckins")}</p> : null}
                <ul className="mt-2 divide-y divide-line border-y border-line" data-testid="desk-checkins">
                  {(checkins.data?.items ?? []).map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                      <span className="w-14 font-bold tabular-nums">{f.time(c.checkedInAt)}</span>
                      <Link href={`/manage/${id}/members/${c.member.id}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">
                        {c.member.displayName} <span className="text-xs font-normal text-muted">{c.member.memberCode}</span>
                      </Link>
                      {!c.counted ? <Badge>{tg("desk.repeat")}</Badge> : null}
                      {c.decision !== "allow" ? <Badge tone={c.decision === "override" ? "danger" : "warning"}>{tg(`decisionShort.${c.decision}`)}</Badge> : null}
                      <span className="text-xs font-bold uppercase text-muted">{tg(`checkinMethod.${c.method}`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {canList ? (
              <div>
                <h3 className="font-semibold">{isToday ? t("desk.today", { n: admissions.data?.items.length ?? 0 }) : t("desk.onDay", { date: f.short(listDate), n: admissions.data?.items.length ?? 0 })}</h3>
                {admissions.isError ? <Notice tone="error">{errorText(admissions.error, t("failed"))}</Notice> : null}
                {admissions.data && !admissions.data.items.length ? <p className="mt-2 text-sm text-muted">{isToday ? t("desk.noneToday") : t("desk.noneOnDay")}</p> : null}
                <ul className="mt-2 divide-y divide-line border-y border-line" data-testid="desk-today">
                  {(admissions.data?.items ?? []).map((a) => (
                    <li key={`${a.passCode}-${a.redeemedAt}`} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                      <span className="w-14 font-bold tabular-nums">{f.time(a.redeemedAt)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{a.holder ?? t("desk.member")}</span>
                        <span className="text-xs text-muted">
                          {" "}
                          · {a.title} · {a.passCode}
                        </span>
                      </span>
                      <span className="text-xs font-bold uppercase text-muted">{t(`desk.method.${a.method}`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <ReasonDialog
        open={Boolean(overriding)}
        onOpenChange={(o) => !o && setOverriding(null)}
        title={tg("desk.overrideTitle", { name: overriding?.name ?? tg("desk.thisMember") })}
        description={tg("desk.overrideBody")}
        confirmLabel={tg("desk.overrideConfirm")}
        danger
        minLength={2}
        maxLength={200}
        busy={busy}
        error={overrideProblem}
        testId="override-dialog"
        onConfirm={(reason) => overriding && void checkIn(overriding.body, overriding.name, { reason })}
      />
    </section>
  );
}

const TONE_BORDER = { ok: "border-brand bg-brand/10", warn: "border-warning bg-warning-soft", bad: "border-danger bg-danger-soft" } as const;

/** One member found at the desk: who, the running package, flags and the entry decision, and the action it allows. */
function MemberCard({ card, busy, locked, onCheckIn, onOverride, gymId }: { card: DeskCard; busy: boolean; locked: boolean; onCheckIn: () => void; onOverride: () => void; gymId: string }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const tone = DECISION_TONE[card.decision];
  const action = deskAction(card);
  const m = card.member;
  return (
    <div className={cn("rounded-card border-2 p-3", TONE_BORDER[tone])} data-testid="desk-member" data-decision={card.decision}>
      <div className="flex items-start gap-3">
        <Avatar name={m.displayName} src={m.avatarUrl} size={48} />
        <div className="min-w-0 flex-1">
          <Link href={`/manage/${gymId}/members/${m.id}`} className="block truncate text-lg font-extrabold hover:underline">
            {m.displayName}
          </Link>
          <p className="text-xs text-muted tabular-nums">
            {m.memberCode} · ••{m.phoneLast4}
          </p>
          <p className="mt-1 text-sm">{card.membership ? t("desk.package", { title: card.membership.title, end: f.short(card.membership.endsOn), days: card.membership.daysLeft }) : t("desk.noPackage")}</p>
          {card.membership?.visitLimit ? <p className="text-xs text-muted">{t("desk.visits", { n: card.membership.visits, max: card.membership.visitLimit })}</p> : null}
          {card.outstandingPoisha ? <p className="text-sm font-semibold">{t("desk.outstanding", { amount: f.taka(card.outstandingPoisha) })}</p> : null}
          {card.flags.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {card.flags.map((fl) => (
                <Badge key={fl} tone={fl === "expiring" ? "warning" : fl === "frozen" ? "info" : "danger"}>
                  {t(`deskFlag.${fl}`)}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <p className={cn("mt-2 text-sm font-bold", tone === "ok" && "text-brand-text", tone === "warn" && "text-warning", tone === "bad" && "text-danger")} data-testid="desk-decision">
        {t(`decision.${card.decision}`)}
        {card.reasons.length ? `: ${card.reasons.map((r) => t(`reason.${r}`)).join(" · ")}` : ""}
      </p>
      {locked ? null : action === "checkIn" || action === "checkInWarn" ? (
        <Button type="button" block size="lg" className="mt-2" busy={busy} onClick={onCheckIn} data-testid="desk-checkin">
          {action === "checkInWarn" ? t("desk.checkInAnyway") : t("desk.checkIn")}
        </Button>
      ) : action === "override" ? (
        <Button type="button" block size="lg" variant="danger" className="mt-2" busy={busy} onClick={onOverride} data-testid="desk-override">
          {t("desk.override")}
        </Button>
      ) : (
        <p className="mt-2 text-sm text-muted">{t("desk.ownerOnly")}</p>
      )}
    </div>
  );
}

/** A pass found by its code: the M20 admission. */
function PassCard({ pass, canAdmit, busy, onAdmit }: { pass: DeskPass; canAdmit: boolean; busy: boolean; onAdmit: () => void }) {
  const t = useTranslations("gm");
  const f = useFmt();
  return (
    <div className="rounded-card border-2 border-line bg-surface p-3" data-testid="desk-pass">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("desk.pass")}</p>
      <p className="mt-1 text-lg font-extrabold">{pass.holder.displayName ?? t("desk.thisMember")}</p>
      <p className="text-sm">
        {pass.title} · <span className="font-mono">{pass.passCode}</span>
      </p>
      <p className="text-xs text-muted">{pass.validFrom === pass.validTo ? f.short(pass.validFrom) : `${f.short(pass.validFrom)} – ${f.short(pass.validTo)}`}</p>
      {canAdmit ? (
        <Button type="button" block size="lg" className="mt-2" busy={busy} onClick={onAdmit} data-testid="desk-pass-admit">
          {t("desk.admitPass")}
        </Button>
      ) : null}
    </div>
  );
}

/** The answer to a check-in: counted, or a repeat with the first time today; warnings stay visible. */
function CheckedIn({ card }: { card: DeskCard }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const repeat = card.counted === false;
  return (
    <div className={cn("rounded-card border-4 p-4", repeat ? "border-info bg-info-soft" : card.decision === "warn" ? "border-warning bg-warning-soft" : "border-brand bg-brand/10")} data-testid="desk-checked-in" data-counted={String(!repeat)}>
      <p className="text-sm font-bold uppercase tracking-wide">{repeat ? t("desk.alreadyIn", { time: f.time(card.firstCheckInToday ?? card.checkedInAt) }) : card.override ? t("desk.inOverride") : t("desk.checkedIn")}</p>
      <p className="mt-1 text-2xl font-extrabold">{card.member.displayName}</p>
      <p className="text-sm text-muted tabular-nums">
        {card.member.memberCode} · {f.time(card.checkedInAt)}
      </p>
      {card.membership ? <p className="mt-1 text-sm">{t("desk.package", { title: card.membership.title, end: f.short(card.membership.endsOn), days: card.membership.daysLeft })}</p> : null}
      {card.reasons.length ? <p className="mt-1 text-sm font-semibold text-warning">{card.reasons.map((r) => t(`reason.${r}`)).join(" · ")}</p> : null}
    </div>
  );
}

