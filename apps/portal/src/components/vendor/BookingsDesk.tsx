"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { CaretLeft, CaretRight, MagnifyingGlass } from "@phosphor-icons/react";
import { Badge, Button, DataTable, FilterBar, IconButton, type Column, type Tone } from "@kriraghor/ui/kit";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { formatTaka } from "@/lib/admin/finance";
import { dhakaIso, halfHours, nextDays, vendor } from "@/lib/vendor/grounds";
import { blockColumns, desk, dhakaDate, hhmm, ownerActions, searchable, shiftDay, timelineWindow, type OwnerBooking, type OwnerCancelReason } from "@/lib/vendor/bookings";
import { ownerTrust } from "@/lib/vendor/trust";
import { allowedBookingActions, deskAccessKey, deskCan, deskChoices, staffPermissionsAt, worksWith } from "@/lib/vendor/team";
import { DeskAccessNotice, useDeskErrorText, useWorkplaces } from "./StaffAccess";
import { Notice } from "@kriraghor/ui/primitives";
import { DatePicker } from "@kriraghor/ui/date";
import { Chip, Field, inputCls } from "../admin/finance/shared";

const TONE: Record<string, string> = {
  pending_payment: "bg-surface-2 border-dashed text-muted",
  confirmed: "bg-brand/15 border-brand text-ink",
  checked_in: "bg-brand text-white border-brand",
  completed: "bg-surface-2 border-line text-muted",
  no_show: "bg-red-100 border-danger text-danger dark:bg-red-950/40",
};
const BADGE: Record<string, Tone> = { pending_payment: "warning", confirmed: "info", checked_in: "brand", completed: "neutral", no_show: "danger" };
const REASONS: OwnerCancelReason[] = ["weather", "waterlogged", "maintenance", "closure", "double_booked_offline", "other"];
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * /vendor/bookings (M10 FR-13 to FR-20, FR-35): one ground's day as a timeline (courts × half-hours,
 * from booking_slots), the booking panel with the owner's actions, and a walk-in form. Check-in
 * releases the online money minus the fee on the full value (v3); the rest is collected at the venue.
 */
export function BookingsDesk() {
  const t = useTranslations("vendorBookings");
  const locale = useLocale();
  const { status } = useAuth();
  // Round B3: venue staff work this desk too, at the venues where they hold bookings.view. The
  // owner's own venues are only asked for when the person is a venue owner or works at no venue.
  const wp = useWorkplaces();
  const staffAtVenue = worksWith(wp.refs, "venue");
  const ownerQuery = status === "signed_in" && !wp.me.isPending && (wp.active.includes("ground_owner") || !staffAtVenue);
  const grounds = useQuery({ queryKey: ["vendor-grounds"], enabled: ownerQuery, queryFn: () => vendor.mine(), retry: false });
  const live = (grounds.data?.items ?? []).filter((g) => g.status === "live" || g.status === "paused");
  const choices = deskChoices("venue", "bookings.view", live, wp.named);
  // A to-do line or a "You work at" button opens a venue (?groundId=).
  const linked = useSearchParams().get("groundId");
  const [groundId, setGroundId] = useState<string | undefined>(() => linked ?? undefined);
  const gid = choices.some((c) => c.value === groundId) ? groundId : choices[0]?.value;
  // Staff permissions at the venue in view (null: the owner, who can do everything here).
  const perms = staffPermissionsAt(wp.refs, "venue", gid);
  const [days] = useState(() => nextDays(8, new Date(Date.now() - 86400000))); // yesterday … a week ahead
  const today = days[1];
  const [day, setDay] = useState(today);
  const [open, setOpen] = useState<string | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const tl = useQuery({ queryKey: ["vendor-timeline", gid, day], queryFn: () => desk.timeline(gid!, day), enabled: Boolean(gid), refetchInterval: 30_000 });
  // Booking search (any venue, any date): a hit jumps the timeline to its venue and day and opens it.
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<OwnerBooking | null>(null);
  const found = useInfiniteQuery({
    // An owner who also works at other venues searches a staff venue by name (the API searches the
    // owner's own venues when none is named, and every staff venue for staff who own none).
    queryKey: ["vendor-booking-search", q, perms && live.length ? gid : null],
    enabled: status === "signed_in" && searchable(q),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => desk.search(q, perms && live.length ? gid : undefined, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const dateFmt = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Dhaka" });
  const groundName = new Map([...(grounds.data?.items ?? []).map((g) => [g.id, g.name] as const), ...choices.map((c) => [c.value, c.label] as const)]);
  const openHit = (b: OwnerBooking) => {
    if (choices.some((c) => c.value === b.groundId)) setGroundId(b.groundId);
    setDay(dhakaDate(b.start));
    setPick(b);
    setOpen(b.id);
  };
  const hitColumns: Column<OwnerBooking>[] = [
    { id: "code", header: t("col.code"), primary: true, cell: (b) => <span className="font-mono font-semibold">{b.code}</span> },
    {
      id: "when",
      header: t("col.when"),
      cell: (b) => (
        <span className="whitespace-nowrap">
          {dateFmt.format(new Date(b.start))} · {hhmm(b.start)}–{hhmm(b.end)}
        </span>
      ),
    },
    { id: "who", header: t("col.who"), cell: (b) => b.teamName ?? b.contactName ?? t("member") },
    { id: "venue", header: t("col.venue"), hideBelow: "lg", cell: (b) => groundName.get(b.groundId) ?? "–" },
    { id: "phone", header: t("col.phone"), cell: (b) => (b.phoneLast4 ? <span className="font-mono">••••{b.phoneLast4}</span> : "–") },
    { id: "status", header: t("col.status"), cell: (b) => <Badge tone={BADGE[b.status] ?? "neutral"}>{t(`status.${b.status}`)}</Badge> },
    { id: "money", header: t("col.money"), align: "end", cell: (b) => formatTaka(b.money.total, locale) },
  ];

  if (status === "signed_out")
    return (
      <section className="mx-auto max-w-3xl px-5 py-10">
        <Link href="/vendor/sign-in" className="font-semibold text-brand underline">
          {t("signIn")}
        </Link>
      </section>
    );
  if (wp.pending || (ownerQuery && grounds.isPending)) return <div className="mx-auto mt-10 h-64 max-w-[1200px] animate-pulse bg-surface-2" />;
  // Staff with a venue to work at never see the owner's gate.
  const problem = choices.length ? null : problemOf(grounds.error);
  if (!choices.length && staffAtVenue && !live.length)
    return (
      <section className="mx-auto max-w-3xl px-5 py-10">
        <DeskAccessNotice code="PERMISSION_REQUIRED" />
      </section>
    );
  if (problem && !["ROLE_REQUIRED", "ROLE_PENDING", "KYC_REQUIRED", "KYC_PENDING"].includes(problem.code))
    return (
      <section className="mx-auto max-w-3xl px-5 py-10">
        <Notice tone="error">{problem.title ?? t("loadFailed")}</Notice>
        <button type="button" onClick={() => void grounds.refetch()} className="mt-4 min-h-11 border-2 border-line px-4 font-semibold">
          {t("retry")}
        </button>
      </section>
    );
  if (problem)
    return (
      <section className="mx-auto max-w-3xl px-5 py-10">
        <Notice tone="error">{t("gate")}</Notice>
        <Link href="/vendor" className="mt-4 inline-block font-semibold text-brand underline">
          {t("gateLink")}
        </Link>
      </section>
    );
  if (!choices.length)
    return (
      <section className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-3 text-muted">{t("noLive")}</p>
        <Link href="/vendor/venues" className="mt-4 inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white">
          {t("toGrounds")}
        </Link>
      </section>
    );

  const data = tl.data;
  // 06:00–23:00, widened to any booking or closure outside it (grounds open late or round the clock).
  const win = timelineWindow([...(data?.bookings ?? []), ...(data?.closures ?? [])], day);
  const SLOTS = halfHours(clock(win.open), clock(win.close - 30));
  const selected = data?.bookings.find((b) => b.id === open) ?? (pick && pick.id === open ? pick : null);
  return (
    <section className="mx-auto max-w-[1400px] px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-muted">{t("lead")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t("ground")}>
            <select className={inputCls} value={gid} onChange={(e) => setGroundId(e.target.value)} data-testid="venue-switch">
              {choices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.staff && c.owner ? t("staffVenue", { name: c.label, owner: c.owner }) : c.label}
                </option>
              ))}
            </select>
          </Field>
          {deskCan(perms, "bookings.walk_in") ? (
            <button type="button" onClick={() => setWalkIn(true)} className="min-h-11 bg-brand px-4 font-bold text-white" data-testid="add-walk-in">
              {t("walkIn")}
            </button>
          ) : null}
          {gid && perms === null ? (
            <Link href={`/vendor/venues/${gid}/schedule`} className="inline-flex min-h-11 items-center border-2 border-line px-4 font-semibold">
              {t("schedule")}
            </Link>
          ) : null}
        </div>
      </div>

      <FilterBar
        className="mt-6"
        search={{ value: q, onChange: setQ, label: t("search.label"), placeholder: t("search.placeholder"), testId: "booking-search" }}
        onClear={() => setQ("")}
      />
      {q && !searchable(q) ? <p className="mt-2 text-sm text-muted">{t("search.hint")}</p> : null}
      {searchable(q) ? (
        <section className="mt-4" aria-label={t("search.title")}>
          <DataTable
            label={t("search.title")}
            columns={hitColumns}
            rows={found.data?.pages.flatMap((p) => p.items)}
            rowId={(b) => b.id}
            loading={found.isPending}
            error={found.error}
            onRetry={() => void found.refetch()}
            empty={{ icon: <MagnifyingGlass aria-hidden />, title: t("search.empty", { q }) }}
            onRowClick={openHit}
            selectedId={open}
            hasMore={found.hasNextPage}
            onMore={() => void found.fetchNextPage()}
            busy={found.isFetchingNextPage}
            testId="booking-search-results"
            rowTestId="booking-search-hit"
          />
        </section>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="tablist" aria-label={t("day")}>
          {days.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === day}
              onClick={() => setDay(d)}
              className={`min-h-11 shrink-0 rounded-pill border px-4 text-sm font-semibold transition-colors ${d === day ? "border-brand bg-brand text-on-brand" : "border-line bg-surface hover:border-line-strong"}`}
            >
              {new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`))}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5" data-testid="day-picker">
          <IconButton label={t("prevDay")} variant="secondary" onClick={() => setDay(shiftDay(day, -1))} data-testid="day-prev">
            <CaretLeft size={18} aria-hidden />
          </IconButton>
          <DatePicker id="day-input" label={t("pickDate")} labelHidden value={day} onChange={(v) => v && setDay(v)} clearable={false} showToday={false} testId="day-input" triggerClassName="w-auto" />
          <IconButton label={t("nextDay")} variant="secondary" onClick={() => setDay(shiftDay(day, 1))} data-testid="day-next">
            <CaretRight size={18} aria-hidden />
          </IconButton>
          <Button type="button" variant="ghost" onClick={() => setDay(today)} disabled={day === today} data-testid="day-today">
            {t("today")}
          </Button>
        </div>
      </div>

      {walkIn && gid && data ? <WalkIn groundId={gid} day={day} courts={data.courts} onClose={() => setWalkIn(false)} /> : null}

      {tl.isPending ? (
        <div className="mt-6 h-64 animate-pulse bg-surface-2" />
      ) : tl.isError || !data ? (
        <div className="mt-6">
          {deskAccessKey(problemOf(tl.error)?.code) ? <DeskAccessNotice error={tl.error} /> : <Notice tone="error">{problemOf(tl.error)?.title ?? t("loadFailed")}</Notice>}
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="overflow-x-auto border-2 border-line" data-testid="timeline">
            <div className="min-w-[1100px]">
              <div className="grid border-b-2 border-line text-[11px] font-semibold text-muted" style={{ gridTemplateColumns: `120px repeat(${SLOTS.length}, minmax(0, 1fr))` }}>
                <span />
                {SLOTS.map((s) => (
                  <span key={s} className="border-l border-line px-0.5 py-1 tabular-nums">
                    {s.endsWith(":00") ? s : ""}
                  </span>
                ))}
              </div>
              {data.courts.map((k) => (
                <div key={k.id} className="grid min-h-14 items-stretch border-b border-line" style={{ gridTemplateColumns: `120px repeat(${SLOTS.length}, minmax(0, 1fr))` }}>
                  <span className="flex items-center px-2 text-sm font-bold" style={{ gridColumn: 1, gridRow: 1 }}>
                    {k.name}
                  </span>
                  {data.closures
                    .filter((x) => x.courtId === k.id)
                    .map((x) => {
                      const c = blockColumns(x.start, x.end, day, win.open, win.close);
                      return c ? (
                        <span key={x.closureId + x.start} className="m-0.5 flex items-center bg-[repeating-linear-gradient(45deg,var(--color-surface-2),var(--color-surface-2)_6px,transparent_6px,transparent_12px)] px-1 text-[11px] font-semibold text-muted" style={{ gridColumn: `${c.from + 1} / span ${c.span}`, gridRow: 1 }}>
                          {t("closed")}
                        </span>
                      ) : null;
                    })}
                  {data.bookings
                    .filter((b) => b.courtIds.includes(k.id) && !b.status.startsWith("cancelled") && b.status !== "skipped")
                    .map((b) => {
                      const c = blockColumns(b.start, b.end, day, win.open, win.close);
                      return c ? (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setOpen(b.id)}
                          aria-pressed={open === b.id}
                          className={`m-0.5 overflow-hidden border-2 px-1 text-left text-[11px] font-semibold ${TONE[b.status] ?? "bg-surface-2"} ${b.late ? "ring-2 ring-amber-400" : ""}`}
                          style={{ gridColumn: `${c.from + 1} / span ${c.span}`, gridRow: 1 }}
                          data-testid="timeline-booking"
                        >
                          <span className="block truncate">{b.teamName ?? b.contactName ?? b.code}</span>
                          <span className="block truncate opacity-80">
                            {hhmm(b.start)}–{hhmm(b.end)}
                          </span>
                        </button>
                      ) : null;
                    })}
                </div>
              ))}
            </div>
          </div>
          <div>
            {selected ? <BookingPanel b={selected} groundId={gid!} day={day} perms={staffPermissionsAt(wp.refs, "venue", selected.groundId)} onClose={() => setOpen(null)} /> : <p className="text-muted">{t("pickBooking")}</p>}
            <h2 className="mt-8 text-lg font-extrabold">{t("list")}</h2>
            <ul className="mt-2 divide-y-2 divide-line border-y-2 border-line text-sm">
              {data.bookings.length ? (
                data.bookings.map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => setOpen(b.id)} className="flex w-full flex-wrap gap-x-3 py-2 text-left hover:bg-surface-2">
                      <span className="font-bold tabular-nums">
                        {hhmm(b.start)}–{hhmm(b.end)}
                      </span>
                      <span>{b.teamName ?? b.contactName ?? b.code}</span>
                      <span className="ml-auto">{t(`status.${b.status}`)}</span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="py-3 text-muted">{t("empty")}</li>
              )}
            </ul>
          </div>
        </div>
      )}
      {perms === null ? <p className="mt-6 text-sm text-muted">{t("moneyNote")}</p> : null}
    </section>
  );
}

/** M18: the booker's reliability, once it is shown (enough bookings). */
function BookerReliability({ userId }: { userId: string }) {
  const t = useTranslations("vendorTrust");
  const q = useQuery({ queryKey: ["trust-of", userId], queryFn: () => ownerTrust.trustOf(userId) });
  const s = q.data?.items.find((x) => x.kind === "booker");
  if (!s || s.score === null) return null;
  return (
    <p className="text-sm font-semibold" data-testid="booker-reliability">
      {t("bookerReliability", { score: s.score })}
    </p>
  );
}

/** perms: the staff member's permissions at this venue (Round B3), or null for the owner. */
function BookingPanel({ b, groundId, day, perms, onClose }: { b: OwnerBooking; groundId: string; day: string; perms: readonly string[] | null; onClose: () => void }) {
  const t = useTranslations("vendorBookings");
  const errorText = useDeskErrorText();
  const locale = useLocale();
  const qc = useQueryClient();
  const [reason, setReason] = useState<OwnerCancelReason>("weather");
  const [confirming, setConfirming] = useState<"cancel" | "move" | null>(null);
  const [method, setMethod] = useState<"cash" | "bkash_venue">("cash");
  const targets = useQuery({ queryKey: ["move-targets", b.id], queryFn: () => desk.moveTargets(b.id), enabled: confirming === "move" });
  const act = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      setConfirming(null);
      void qc.invalidateQueries({ queryKey: ["vendor-timeline", groundId, day] });
      void qc.invalidateQueries({ queryKey: ["vendor-booking-search"] });
    },
  });
  const money = (n: number) => formatTaka(n, locale);
  // Staff see only the buttons the owner allowed (cancel and move are off by default, Q170).
  const actions = allowedBookingActions(ownerActions(b), perms);
  const problem = act.error ? errorText(act.error, t("loadFailed")) : null;

  return (
    <div className="border-2 border-line-strong p-4" data-testid="booking-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted">{b.code}</p>
          <p className="text-lg font-extrabold">{b.teamName ?? b.contactName ?? t("member")}</p>
          <p className="text-sm text-muted">
            {hhmm(b.start)}–{hhmm(b.end)} · {t(`source.${b.source}`)}
            {b.phoneLast4 ? ` · ••••${b.phoneLast4}` : ""}
          </p>
          {b.bookerUserId ? <BookerReliability userId={b.bookerUserId} /> : null}
        </div>
        <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm font-semibold underline">
          {t("close")}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Chip tone={b.status === "checked_in" || b.status === "completed" ? "ok" : b.status === "no_show" ? "bad" : "muted"}>{t(`status.${b.status}`)}</Chip>
        {b.late ? <Chip tone="warn">{t("late")}</Chip> : null}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted">{t("total")}</dt>
        <dd className="text-right font-bold tabular-nums">{money(b.money.total)}</dd>
        <dt className="text-muted">{t("paidOnline")}</dt>
        <dd className="text-right font-bold tabular-nums">{money(b.money.paidOnline)}</dd>
        <dt className="text-muted">{t("dueAtVenue")}</dt>
        <dd className="text-right font-bold tabular-nums" data-testid="panel-due">
          {money(b.money.dueAtVenue)} {b.money.balanceStatus === "collected" ? `(${t("collected")})` : ""}
        </dd>
        {/* Staff answers carry no fee (B3): the row is left out. */}
        {typeof b.money.fee === "number" ? (
          <>
            <dt className="text-muted">{t("fee")}</dt>
            <dd className="text-right tabular-nums">{money(b.money.fee)}</dd>
          </>
        ) : null}
      </dl>
      {problem ? (
        <div className="mt-3">
          <Notice tone="error">{problem}</Notice>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.includes("check_in") ? (
          <button type="button" className="min-h-11 bg-brand px-4 font-bold text-white" onClick={() => act.mutate(() => desk.checkIn(b.id))} data-testid="check-in">
            {t("checkIn")}
          </button>
        ) : null}
        {actions.includes("extend") ? (
          <button type="button" className="min-h-11 border-2 border-line px-4 font-semibold" onClick={() => act.mutate(() => desk.extend(b.id))}>
            {t("extend")}
          </button>
        ) : null}
        {actions.includes("no_show") ? (
          <button type="button" className="min-h-11 border-2 border-danger px-4 font-semibold text-danger" onClick={() => act.mutate(() => desk.noShow(b.id))} data-testid="no-show">
            {t("noShow")}
          </button>
        ) : null}
        {actions.includes("move") ? (
          <button type="button" className="min-h-11 border-2 border-line px-4 font-semibold" onClick={() => setConfirming("move")}>
            {t("move")}
          </button>
        ) : null}
        {actions.includes("cancel") ? (
          <button type="button" className="min-h-11 border-2 border-danger px-4 font-semibold text-danger" onClick={() => setConfirming("cancel")}>
            {t("cancel")}
          </button>
        ) : null}
      </div>
      {actions.includes("collect") ? (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t-2 border-line pt-4">
          <Field label={t("method")}>
            <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value as "cash" | "bkash_venue")}>
              <option value="cash">{t("cash")}</option>
              <option value="bkash_venue">{t("bkash")}</option>
            </select>
          </Field>
          <button type="button" className="min-h-11 bg-brand px-4 font-bold text-white" onClick={() => act.mutate(() => desk.collect(b.id, method, b.money.dueAtVenue))} data-testid="collect">
            {t("collect", { amount: money(b.money.dueAtVenue) })}
          </button>
        </div>
      ) : null}
      {confirming === "cancel" ? (
        <div className="mt-4 border-2 border-danger p-3" role="alertdialog" aria-label={t("cancelTitle")}>
          <p className="font-bold">{t("cancelTitle")}</p>
          <p className="mt-1 text-sm">{t("cancelHelp", { amount: money(b.money.paidOnline) })}</p>
          <Field label={t("reason")}>
            <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value as OwnerCancelReason)}>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`reasons.${r}`)}
                </option>
              ))}
            </select>
          </Field>
          <div className="mt-3 flex gap-2">
            <button type="button" className="min-h-11 bg-danger px-4 font-bold text-white" onClick={() => act.mutate(() => desk.cancel(b.id, reason))}>
              {t("confirmCancel", { amount: money(b.money.paidOnline) })}
            </button>
            <button type="button" className="min-h-11 border-2 border-line px-4 font-semibold" onClick={() => setConfirming(null)}>
              {t("keep")}
            </button>
          </div>
        </div>
      ) : null}
      {confirming === "move" ? (
        <div className="mt-4 border-2 border-line p-3">
          <p className="font-bold">{t("moveTitle")}</p>
          {targets.isPending ? (
            <div className="mt-2 h-12 animate-pulse bg-surface-2" />
          ) : targets.data?.items.length ? (
            <ul className="mt-2 space-y-1">
              {targets.data.items.map((x) => (
                <li key={x.courtId}>
                  <button type="button" className="min-h-11 w-full border-2 border-line px-3 text-left text-sm font-semibold hover:border-brand" onClick={() => act.mutate(() => desk.move(b.id, x.courtId))}>
                    {x.groundName} · {x.courtName} {x.sameGround ? "" : `(${t("otherGround")})`}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">{t("noTargets")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function WalkIn({ groundId, day, courts, onClose }: { groundId: string; day: string; courts: { id: string; name: string }[]; onClose: () => void }) {
  const t = useTranslations("vendorBookings");
  const qc = useQueryClient();
  const [court, setCourt] = useState(courts[0]?.id ?? "");
  const [time, setTime] = useState(() => {
    const now = new Date(Date.now() + 6 * 3600000);
    const m = Math.floor((now.getUTCHours() * 60 + now.getUTCMinutes()) / 30) * 30;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  });
  const [minutes, setMinutes] = useState(60);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const save = useMutation({
    mutationFn: () => desk.walkIn(groundId, { courtIds: [court], start: dhakaIso(day, time), minutes, name: name.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vendor-timeline", groundId, day] });
      onClose();
    },
  });
  const errorText = useDeskErrorText();
  const problem = save.error ? errorText(save.error, t("loadFailed")) : null;
  return (
    <form
      className="mt-5 grid gap-3 border-2 border-line-strong p-4 md:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <p className="font-bold md:col-span-6">{t("walkInTitle")}</p>
      <Field label={t("court")}>
        <select className={inputCls} value={court} onChange={(e) => setCourt(e.target.value)}>
          {courts.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("start")}>
        <select className={inputCls} value={time} onChange={(e) => setTime(e.target.value)}>
          {halfHours("00:00", "23:30").map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      <Field label={t("length")}>
        <select className={inputCls} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {[60, 90, 120, 180].map((m) => (
            <option key={m} value={m}>
              {t("minutes", { n: m })}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("name")}>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
      </Field>
      <Field label={t("phoneOptional")}>
        <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="off" />
      </Field>
      <div className="flex items-end gap-2">
        <button type="submit" disabled={save.isPending} className="min-h-11 bg-brand px-4 font-bold text-white disabled:opacity-50">
          {t("save")}
        </button>
        <button type="button" onClick={onClose} className="min-h-11 border-2 border-line px-3 font-semibold">
          {t("close")}
        </button>
      </div>
      <p className="text-sm text-muted md:col-span-6">{t("walkInHelp")}</p>
      {problem ? (
        <div className="md:col-span-6">
          <Notice tone="error">{problem}</Notice>
        </div>
      ) : null}
    </form>
  );
}
