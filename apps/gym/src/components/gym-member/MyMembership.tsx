"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft, QrCode, Snowflake } from "@phosphor-icons/react";
import { useAuth } from "@kriraghor/ui/auth";
import { SignedOutCard } from "@kriraghor/ui/account";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { Badge, Button, ButtonLink, Card, Dialog, Notice, Skeleton, Textarea, useToast } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { dhakaToday, gymMe, monthOf, type Due, type Membership } from "@/lib/gym-manage";
import { MemberStatus, Row, useFmt, useGymError } from "@/components/gym-manage/common";
import { MonthCalendar } from "@/components/gym-manage/MonthCalendar";
import { ReceiptLink } from "@/components/gym-manage/money";

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

function Body({ data, memberId, f }: { data: Awaited<ReturnType<typeof gymMe.membership>>; memberId: string; f: ReturnType<typeof useFmt> }) {
  const t = useTranslations("gm");
  const m = data.member;
  const memberships = data.memberships.filter((x): x is Membership => Boolean(x));
  const dues = data.dues.filter((x): x is Due => Boolean(x));
  const running = memberships.find((x) => x.status === "active" || x.status === "frozen") ?? memberships.find((x) => x.status === "upcoming");
  const readOnly = !m.linked || m.status === "left" || m.status === "removed";
  return (
    <div className="mt-2 flex flex-col gap-4">
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
          <ButtonLink href={`/me/checkin?m=${memberId}`} icon={<QrCode size={18} aria-hidden />} className="self-start">
            {t("me.checkinQr")}
          </ButtonLink>
        </Card>
      ) : null}
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
                {(d.outstandingPoisha ?? 0) > 0 ? <p className="mt-1 text-xs text-muted">{t("me.payCounter")}</p> : null}
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
      <Button type="button" size="sm" variant="secondary" onClick={save} busy={busy} className="self-start" data-testid="health-save">
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
