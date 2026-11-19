"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft, ClipboardText, QrCode, Snowflake } from "@phosphor-icons/react";
import { useAuth } from "@kriraghor/ui/auth";
import { SignedOutCard } from "@kriraghor/ui/account";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { Badge, Button, ButtonLink, Card, Dialog, Field, Notice, Select, Skeleton, Textarea, useToast } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { dhakaToday, gymMe, monthOf, type Due, type Membership } from "@/lib/gym-manage";
import { MemberStatus, Row, useFmt, useGymError } from "@/components/gym-manage/common";
import { MonthCalendar } from "@/components/gym-manage/MonthCalendar";
import { ReceiptLink } from "@/components/gym-manage/money";
import { PayDueButton, useMyDues } from "./MyDues";
import { MyPointsCard } from "./MyClasses";
import { RenewCard } from "./RenewCard";
import { BodyProgressView } from "./BodyProgress";
import { gymBody } from "@/lib/gym-progress";

/**
 * /me/memberships/[memberId] (M24 §4.1, FR-18): one gym I belong to. Package and period, days left,
 * freezes, dues and payments, receipts, the check-in calendar, my health note (shown to the gym's
 * trainers) and **Unlink from this gym**. Unlinked or left: a read-only history.
 */
export function MyMembership({ memberId }: { memberId: string }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const { status } = useAuth();
  const q = useQuery({ queryKey: ["my-gym-membership", memberId], queryFn: () => gymMe.membership(memberId), enabled: status === "signed_in" });
  if (status === "signed_out") return <SignedOutCard signInHref={`/sign-in?next=/me/memberships/${memberId}`} />;
  return (
    <section className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-6 md:py-10" data-testid="me-membership">
      <Link href="/me" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline">
        <ArrowLeft size={16} aria-hidden /> {t("me.title")}
      </Link>
      {q.isPending ? (
        <Skeleton className="mt-4 h-96 rounded-card" />
      ) : q.isError ? (
        <Notice tone="error" className="mt-4">
          {err(q.error)}
        </Notice>
      ) : (
        <Body data={q.data} memberId={memberId} f={f} />
      )}
    </section>
  );
}

/** My body progress (M24 §20): hidden when the gym's plan does not include it. A member removes only what they recorded. */
function MyBodyProgress({ memberId }: { memberId: string }) {
  const qc = useQueryClient();
  const key = ["my-gym-body", memberId];
  const q = useQuery({ queryKey: key, queryFn: () => gymBody.mine(memberId) });
  if (!q.data?.on) return null;
  const saved = async (fresh: Awaited<ReturnType<typeof gymBody.mine>>) => {
    qc.setQueryData(key, fresh);
    await qc.invalidateQueries({ queryKey: ["my-gym-membership", memberId] });
  };
  return (
    <BodyProgressView
      data={q.data}
      testId="me-body"
      onAdd={async (body, idem) => saved(await gymBody.addMine(memberId, body, idem))}
      onRemove={async (entryId) => saved(await gymBody.voidMine(memberId, entryId))}
      canRemove={(e) => e.byRole === "member"}
    />
  );
}

function Body({ data, memberId, f }: { data: Awaited<ReturnType<typeof gymMe.membership>>; memberId: string; f: ReturnType<typeof useFmt> }) {
  const t = useTranslations("gm");
  const m = data.member;
  const memberships = data.memberships.filter((x): x is Membership => Boolean(x));
  const dues = data.dues.filter((x): x is Due => Boolean(x));
  const running = memberships.find((x) => x.status === "active" || x.status === "frozen") ?? memberships.find((x) => x.status === "upcoming");
  const readOnly = !m.linked || m.status === "left" || m.status === "removed";
  const myDues = useMyDues();
  const payable = new Map((myDues.data?.items ?? []).map((x) => [x.dueId, x] as const));
  return (
    <div className="mt-2 flex flex-col gap-4">
      {/* Kriraghor suspended the gym (19 Nov 2026): nothing works there for now. */}
      {m.gym?.suspended ? (
        <Notice tone="warning" title={t("me.gymClosed")}>
          {t("me.gymClosedBody")}
        </Notice>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{m.gym?.name ?? t("me.gym")}</h1>
          <p className="text-sm text-muted tabular-nums">
            {m.memberCode} · {m.displayName} · {t("profile.joined", { date: f.date(m.joinedOn) })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MemberStatus status={m.status} />
          {!m.linked ? <Badge>{t("profile.notLinked")}</Badge> : null}
        </div>
      </div>
      {readOnly ? <Notice tone="info">{t("me.readOnly")}</Notice> : null}
      {running && !readOnly ? (
        <Card className="flex flex-col gap-2" data-testid="me-running">
          <p className="text-sm text-muted">{t("me.current")}</p>
          <p className="font-display text-2xl font-extrabold">{running.title}</p>
          <p className="text-sm">
            {f.date(running.startsOn)} – {f.date(running.endsOn)} · {running.status === "frozen" ? t("flag.frozen") : t("ms.daysLeft", { n: running.daysLeft })}
          </p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/me/checkin?m=${memberId}`} icon={<QrCode size={18} aria-hidden />}>
              {t("me.checkinQr")}
            </ButtonLink>
            <ButtonLink href="/me/plans" variant="secondary" icon={<ClipboardText size={18} aria-hidden />} data-testid="me-membership-plans">
              {t("me.nav.plans")}
            </ButtonLink>
          </div>
        </Card>
      ) : null}
      {!readOnly ? <RenewCard memberId={memberId} payable={payable} /> : null}
      {!readOnly ? <MyBodyProgress memberId={memberId} /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card padded={false} className="p-4">
          <h2 className="font-display text-lg font-bold">{t("profile.memberships")}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {memberships.map((ms) => (
              <li key={ms.id} className="rounded-control border border-line p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold">{ms.title}</p>
                  <Badge>{t(`msStatus.${ms.status}`)}</Badge>
                </div>
                <p className="text-sm text-muted">
                  {f.date(ms.startsOn)} – {f.date(ms.endsOn)}
                </p>
                {ms.freezes.filter((fr) => fr.status !== "cancelled").map((fr) => (
                  <p key={fr.id} className="mt-1 flex items-center gap-1 text-xs text-muted">
                    <Snowflake size={14} aria-hidden /> {f.short(fr.fromOn)} – {f.short(fr.endedEarlyOn ?? fr.toOn)} · {t(`freezeStatus.${fr.status}`)}
                  </p>
                ))}
              </li>
            ))}
            {!memberships.length ? <p className="text-sm text-muted">{t("ms.none")}</p> : null}
          </ul>
        </Card>
        <Card padded={false} className="p-4" data-testid="me-dues">
          <h2 className="font-display text-lg font-bold">{t("profile.dues")}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {dues.map((d) => (
              <li key={d.id} className={cn("rounded-control border border-line p-3", d.overdue && "border-danger/50")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm">{t("profile.dueOn", { date: f.date(d.dueOn) })}</span>
                  <span className="flex gap-1">
                    <Badge tone={d.status === "paid" ? "brand" : d.status === "unpaid" || d.status === "partial" ? "warning" : "neutral"}>{t(`dueStatus.${d.status}`)}</Badge>
                    {d.overdue ? <Badge tone="danger">{t("flag.overdue")}</Badge> : null}
                  </span>
                </div>
                {d.amountPoisha !== undefined ? (
                  <div className="divide-y divide-line">
                    <Row label={t("money.amountDue")}>{f.taka(d.amountPoisha)}</Row>
                    <Row label={t("money.paid")}>{f.taka(d.paidPoisha)}</Row>
                    {d.waivedPoisha ? <Row label={t("money.waivedLabel")}>{f.taka(d.waivedPoisha)}</Row> : null}
                    <Row label={t("money.outstandingLabel")}>{f.taka(d.outstandingPoisha)}</Row>
                  </div>
                ) : null}
                {(d.outstandingPoisha ?? 0) > 0 ? (
                  <div className="mt-2">{payable.get(d.id) && !readOnly ? <PayDueButton due={payable.get(d.id)!} size="sm" /> : <p className="text-xs text-muted">{t("me.payCounter")}</p>}</div>
                ) : null}
              </li>
            ))}
            {!dues.length ? <p className="text-sm text-muted">{t("profile.noDues")}</p> : null}
          </ul>
        </Card>
        <Card padded={false} className="p-4" data-testid="me-membership-receipts">
          <h2 className="font-display text-lg font-bold">{t("me.receipts")}</h2>
          <ul className="mt-2 divide-y divide-line">
            {data.receipts.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="tabular-nums">{f.short(r.paidOn)}</span>
                <span className="font-semibold tabular-nums">{f.taka(r.amountPoisha)}</span>
                <span className="text-muted">{t(`method.${r.method}`)}</span>
                <span className="text-xs text-muted">{r.receiptNo}</span>
                {r.reversedOn ? <Badge tone="danger">{t("receipt.reversedOn", { date: f.short(r.reversedOn) })}</Badge> : null}
                <span className="ml-auto">
                  <ReceiptLink url={r.url} />
                </span>
              </li>
            ))}
            {!data.receipts.length ? <p className="py-2 text-sm text-muted">{t("me.noReceipts")}</p> : null}
          </ul>
        </Card>
        <Calendar memberId={memberId} />
        {!readOnly ? <MyPointsCard memberId={memberId} /> : null}
        {!readOnly && m.health ? <MyBody memberId={memberId} health={m.health} /> : null}
        {!readOnly ? <HealthNote memberId={memberId} note={m.healthNote ?? null} at={m.healthNoteAt ?? null} /> : null}
        {m.linked ? <Unlink memberId={memberId} gym={m.gym?.name ?? ""} /> : null}
      </div>
    </div>
  );
}

function Calendar({ memberId }: { memberId: string }) {
  const t = useTranslations("gm");
  const [month, setMonth] = useState(monthOf(dhakaToday()));
  const q = useQuery({ queryKey: ["my-gym-attendance", memberId, month], queryFn: () => gymMe.attendance(memberId, month) });
  return (
    <Card padded={false} className="p-4">
      <h2 className="mb-2 font-display text-lg font-bold">{t("profile.checkins")}</h2>
      <MonthCalendar month={month} onMonth={setMonth} days={(q.data?.days ?? []).map((d) => d.date)} count={q.data?.count ?? 0} />
    </Card>
  );
}

type Health = NonNullable<Awaited<ReturnType<typeof gymMe.membership>>["member"]["health"]>;
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

/**
 * My body (M27-FR-30): blood group, height and weight with the BMI, and conditions or injuries for my
 * trainer. Only I, the gym owner and trainers who write my plans see height, weight and conditions; the
 * desk sees the blood group (for an emergency).
 */
function MyBody({ memberId, health }: { memberId: string; health: Health }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const [d, setD] = useState({ bloodGroup: health.bloodGroup ?? "", heightCm: health.heightCm == null ? "" : String(health.heightCm), weightKg: health.weightKg == null ? "" : String(health.weightKg), medical: health.medical ?? "" });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = async () => {
    const h = d.heightCm.trim() ? Number(d.heightCm) : null;
    const w = d.weightKg.trim() ? Math.round(Number(d.weightKg) * 10) / 10 : null;
    if ((h !== null && !(Number.isInteger(h) && h >= 50 && h <= 250)) || (w !== null && !(w >= 10 && w <= 400))) return setProblem(t("health.bodyBad"));
    setBusy(true);
    setProblem(null);
    try {
      await gymMe.health(memberId, { bloodGroup: (d.bloodGroup || null) as Health["bloodGroup"], heightCm: h, weightKg: w, medical: d.medical.trim() || null });
      await qc.invalidateQueries({ queryKey: ["my-gym-membership", memberId] });
      toast.show(t("saved"));
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card padded={false} className="flex flex-col gap-3 p-4" data-testid="me-body">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-bold">{t("health.mine")}</h2>
        {health.bmi ? (
          <span className="text-sm">
            {t("health.bmi")} <span className="font-display text-xl font-extrabold tabular-nums">{f.n(health.bmi.value)}</span>{" "}
            <Badge tone={health.bmi.band === "normal" ? "brand" : "warning"}>{t(`health.band.${health.bmi.band}`)}</Badge>
          </span>
        ) : null}
      </div>
      <p className="text-sm text-muted">{t("health.mineBody")}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Select id="my-blood" label={t("health.bloodGroup")} value={d.bloodGroup} onChange={(e) => setD({ ...d, bloodGroup: e.target.value })}>
          <option value="">–</option>
          {BLOOD.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>
        <Field id="my-height" label={t("health.height")} inputMode="numeric" value={d.heightCm} onChange={(e) => setD({ ...d, heightCm: e.target.value.replace(/\D/g, "") })} />
        <Field id="my-weight" label={t("health.weight")} inputMode="decimal" value={d.weightKg} onChange={(e) => setD({ ...d, weightKg: e.target.value.replace(/[^\d.]/g, "") })} />
      </div>
      <Textarea id="my-medical" label={t("health.medical")} optional={t("optional")} hint={t("health.mineMedicalHint")} value={d.medical} maxLength={500} onChange={(e) => setD({ ...d, medical: e.target.value })} />
      {problem ? <p role="alert" className="text-sm text-danger">{problem}</p> : null}
      <Button type="button" size="sm" variant="secondary" onClick={save} busy={busy} confirm="save" className="self-start" data-testid="body-save">
        {t("save")}
      </Button>
    </Card>
  );
}

function HealthNote({ memberId, note, at }: { memberId: string; note: string | null; at: string | null }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState(note ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await gymMe.healthNote(memberId, text.trim() ? text.trim() : null);
      await qc.invalidateQueries({ queryKey: ["my-gym-membership", memberId] });
      toast.show(t("saved"));
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card padded={false} className="flex flex-col gap-2 p-4" data-testid="me-health">
      <h2 className="font-display text-lg font-bold">{t("me.healthNote")}</h2>
      <p className="text-sm text-muted">{t("me.healthNoteBody")}</p>
      <Textarea id="health-note" label={t("me.healthNoteLabel")} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} hint={at ? t("me.healthNoteAt", { date: f.date(at) }) : undefined} />
      {problem ? <p role="alert" className="text-sm text-danger">{problem}</p> : null}
      <Button type="button" size="sm" variant="secondary" onClick={save} busy={busy} confirm="save" className="self-start" data-testid="health-save">
        {t("save")}
      </Button>
    </Card>
  );
}

function Unlink({ memberId, gym }: { memberId: string; gym: string }) {
  const t = useTranslations("gm");
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await gymMe.unlink(memberId);
      await qc.invalidateQueries({ queryKey: ["my-gym-memberships"] });
      await qc.invalidateQueries({ queryKey: ["my-gym-membership", memberId] });
      toast.show(t("me.unlinked", { gym }));
      setOpen(false);
      router.push("/me");
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card padded={false} className="flex flex-col gap-2 p-4">
      <h2 className="font-display text-lg font-bold">{t("me.unlinkTitle")}</h2>
      <p className="text-sm text-muted">{t("me.unlinkBody", { gym })}</p>
      <Button type="button" variant="danger" size="sm" className="self-start" onClick={() => setOpen(true)} data-testid="me-unlink">
        {t("me.unlink")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("me.unlinkConfirm", { gym })}
        description={t("me.unlinkBody", { gym })}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button type="button" variant="danger" onClick={go} busy={busy} data-testid="me-unlink-yes">
              {t("me.unlink")}
            </Button>
          </>
        }
      >
        {problem ? <p role="alert" className="text-sm text-danger">{problem}</p> : null}
      </Dialog>
    </Card>
  );
}
