"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CheckCircle } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { newKey } from "@kriraghor/ui/format";
import { DatePicker } from "@kriraghor/ui/date";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Button, ButtonLink, Card, Checkbox, Field, Notice, PhoneField, Select, Textarea, useToast } from "@kriraghor/ui/kit";
import { dhakaToday, gymManage, takaToPoisha, type MemberInput } from "@/lib/gym-manage";
import { birthRange, memberProblems } from "@/lib/validate";
import { GymPage, useFmt, useGymError, useDeskPackages, type GymCtx } from "./common";
import { emptyPayment, PaymentFields, paymentBody, ReceiptLink } from "./money";

/**
 * /manage/[gymId]/members/new (M24-FR-10, FR-25, FR-26, FR-33): the person (name, phone, gender, date
 * of birth, photo, email, emergency contact, a first note), optionally a package from a start date
 * (admission fee and a discount with fees.adjust) and the first payment (fees.collect), in one request
 * with an Idempotency-Key. A phone already on the list opens that member instead. Every field is checked
 * before sending (an 11-digit 01 mobile, a real email, a birth date 5 to 100 years ago; 19 Nov 2026).
 */
export function MemberNew({ gymId }: { gymId: string }) {
  const t = useTranslations("gm");
  return (
    <GymPage gymId={gymId} page="members" title={t("new.title")} back={{ href: `/manage/${gymId}/members`, label: t("members.title") }} testId="gm-member-new">
      {(ctx) => (ctx.can("members.edit") ? <Form ctx={ctx} /> : <Notice tone="warning">{t("new.noPermission")}</Notice>)}
    </GymPage>
  );
}

type Draft = { displayName: string; phone: string; gender: "" | "male" | "female" | "other"; birthDate: string; email: string; ecName: string; ecPhone: string; notes: string };
const EMPTY: Draft = { displayName: "", phone: "", gender: "", birthDate: "", email: "", ecName: "", ecPhone: "", notes: "" };

function Form({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const { gymId } = ctx;
  const packages = useDeskPackages(gymId, ctx.owner || ctx.can("members.view"));
  const canAdjust = ctx.can("fees.adjust");
  const canCollect = ctx.can("fees.collect");
  const [d, setD] = useState<Draft>(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [withMs, setWithMs] = useState(true);
  const [ms, setMs] = useState({ packageId: "", startsOn: dhakaToday(), admission: true, discountTaka: "", discountReason: "" });
  const [withPay, setWithPay] = useState(false);
  const [pay, setPay] = useState(emptyPayment());
  const [key, setKey] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ text: string; memberId?: string } | null>(null);
  const [done, setDone] = useState<{ id: string; name: string; code: string; receiptUrl: string | null } | null>(null);
  const set = (k: keyof Draft, v: string) => setD((x) => ({ ...x, [k]: v }));
  // Field messages show once Add was tried, then follow every change.
  const [tried, setTried] = useState(false);
  const today = dhakaToday();
  const problems = memberProblems(d, today, photo);
  const shown = (k: string) => (tried && problems[k] ? t(`check.${problems[k]}`) : undefined);
  const pkg = packages.desk.find((p) => p.id === ms.packageId);
  const discount = ms.discountTaka.trim() ? takaToPoisha(ms.discountTaka, { allowZero: true }) : 0;
  const expected = pkg ? Math.max(0, pkg.price + (ms.admission ? pkg.admissionFee : 0) - (discount ?? 0)) : undefined;
  const msOn = withMs && packages.desk.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    setTried(true);
    if (Object.keys(problems).length) return setProblem({ text: t("check.fix") });
    const body: MemberInput = { displayName: d.displayName.trim(), phone: d.phone.trim() };
    if (d.gender) body.gender = d.gender;
    if (d.birthDate) body.birthDate = d.birthDate;
    if (d.email.trim()) body.email = d.email.trim();
    if (d.ecName.trim() && d.ecPhone.trim()) body.emergencyContact = { name: d.ecName.trim(), phone: d.ecPhone.trim() };
    if (d.notes.trim()) body.notes = d.notes.trim();
    if (msOn) {
      if (!ms.packageId) return setProblem({ text: t("new.choosePackage") });
      body.membership = { packageId: ms.packageId, startsOn: ms.startsOn };
      if (canAdjust && !ms.admission) body.membership.admissionFee = false;
      if (canAdjust && ms.discountTaka.trim()) {
        if (discount === null) return setProblem({ text: t("money.badAmount") });
        if (discount > 0) {
          if (ms.discountReason.trim().length < 2) return setProblem({ text: t("new.discountReason") });
          body.membership.discountPoisha = discount;
          body.membership.discountReason = ms.discountReason.trim();
        }
      }
      if (canCollect && withPay) {
        const p = paymentBody(pay, canAdjust);
        if (!p.ok) return setProblem({ text: t("money.badAmount") });
        body.payment = p.payment;
      }
    }
    setBusy(true);
    try {
      const r = await gymManage.addMember(gymId, body, key);
      if (photo) await gymManage.setPhoto(gymId, r.member.id, photo).catch(() => toast.show(t("new.photoFailed"), "error"));
      await qc.invalidateQueries({ queryKey: ["gm-members", gymId] });
      await qc.invalidateQueries({ queryKey: ["gm-overview", gymId] });
      setDone({ id: r.member.id, name: r.member.displayName, code: r.member.memberCode, receiptUrl: r.payment?.receiptUrl ?? null });
      toast.show(t("new.added", { code: r.member.memberCode }));
    } catch (e2) {
      const p = problemOf(e2) as (ReturnType<typeof problemOf> & { memberId?: string }) | null;
      setProblem({ text: err(e2), memberId: p?.code === "GYM_MEMBER_PHONE_TAKEN" ? p.memberId : undefined });
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <Card className="flex flex-col gap-3" data-testid="member-added">
        <p className="flex items-center gap-2 font-display text-lg font-bold">
          <CheckCircle size={24} weight="fill" className="text-brand-text" aria-hidden /> {t("new.done", { name: done.name, code: done.code })}
        </p>
        <ReceiptLink url={done.receiptUrl} label={t("money.openReceipt")} />
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/manage/${gymId}/members/${done.id}`} data-testid="open-member">
            {t("new.openProfile")}
          </ButtonLink>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setDone(null);
              setD(EMPTY);
              setPhoto(null);
              setPay(emptyPayment());
              setKey(newKey());
            }}
          >
            {t("new.another")}
          </Button>
        </div>
      </Card>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" data-testid="member-form">
      <Card className="grid gap-3 sm:grid-cols-2">
        <h2 className="font-display text-lg font-bold sm:col-span-2">{t("new.person")}</h2>
        <Field id="m-name" label={t("member.name")} value={d.displayName} onChange={(e) => set("displayName", e.target.value)} required minLength={2} maxLength={80} autoComplete="off" error={shown("displayName")} data-testid="m-name" />
        <PhoneField id="m-phone" label={t("member.phone")} value={d.phone} onChange={(v) => set("phone", v)} required placeholder="01XXXXXXXXX" error={shown("phone")} data-testid="m-phone" />
        <Select id="m-gender" label={t("member.gender")} optional={t("optional")} value={d.gender} onChange={(e) => set("gender", e.target.value)}>
          <option value="">–</option>
          {(["male", "female", "other"] as const).map((g) => (
            <option key={g} value={g}>
              {t(`gender.${g}`)}
            </option>
          ))}
        </Select>
        <DatePicker id="m-birth" label={t("member.birthDate")} optional={t("optional")} value={d.birthDate} min={birthRange(today).min} max={birthRange(today).max} error={shown("birthDate")} onChange={(v) => set("birthDate", v)} />
        <Field id="m-email" type="email" label={t("member.email")} optional={t("optional")} value={d.email} maxLength={120} error={shown("email")} onChange={(e) => set("email", e.target.value)} />
        <Field id="m-photo" type="file" accept="image/jpeg,image/png,image/webp" label={t("member.photo")} optional={t("optional")} hint={t("check.photoHint")} error={shown("photo")} onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        <Field id="m-ec-name" label={t("member.ecName")} optional={t("optional")} value={d.ecName} onChange={(e) => set("ecName", e.target.value)} maxLength={80} error={shown("ecName")} />
        <PhoneField id="m-ec-phone" label={t("member.ecPhone")} optional={t("optional")} value={d.ecPhone} onChange={(v) => set("ecPhone", v)} error={shown("ecPhone")} />
        <Textarea id="m-notes" label={t("member.firstNote")} optional={t("optional")} hint={t("member.noteHint")} value={d.notes} onChange={(e) => set("notes", e.target.value)} maxLength={2000} className="sm:col-span-2" />
      </Card>

      <Card className="flex flex-col gap-3">
        <Checkbox id="m-with-ms" label={t("new.withPackage")} checked={withMs} onChange={(e) => setWithMs(e.target.checked)} />
        {withMs && !packages.desk.length ? (
          <Notice tone="info">{ctx.owner ? (packages.q.isPending ? t("loading") : <>{t("new.noPackagesOwner")} <Link href={`/manage/${gymId}/packages`} className="font-semibold underline">{t("nav.packages")}</Link></>) : t("new.noPackagesStaff")}</Notice>
        ) : null}
        {msOn ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Select id="m-package" label={t("member.package")} value={ms.packageId} onChange={(e) => setMs({ ...ms, packageId: e.target.value })} data-testid="m-package">
              <option value="">{t("new.choosePackage")}</option>
              {packages.desk.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} · {f.taka(p.price)}
                  {p.admissionFee ? ` + ${f.taka(p.admissionFee)}` : ""}
                </option>
              ))}
            </Select>
            <DatePicker id="m-start" label={t("member.startsOn")} value={ms.startsOn} onChange={(v) => setMs({ ...ms, startsOn: v })} />
            {canAdjust ? (
              <>
                <Checkbox id="m-admission" label={t("new.admission", { amount: f.taka(pkg?.admissionFee ?? 0) })} checked={ms.admission} onChange={(e) => setMs({ ...ms, admission: e.target.checked })} className="sm:col-span-2" />
                <Field id="m-discount" label={t("new.discount")} optional={t("optional")} inputMode="decimal" value={ms.discountTaka} onChange={(e) => setMs({ ...ms, discountTaka: e.target.value })} leading={<span className="text-muted">৳</span>} />
                <Field id="m-discount-reason" label={t("new.discountReasonLabel")} optional={t("optional")} value={ms.discountReason} onChange={(e) => setMs({ ...ms, discountReason: e.target.value })} maxLength={200} />
              </>
            ) : null}
            {expected !== undefined ? <p className="text-sm font-semibold sm:col-span-2">{t("new.dueWillBe", { amount: f.taka(expected) })}</p> : null}
          </div>
        ) : null}
      </Card>

      {msOn && canCollect ? (
        <Card className="flex flex-col gap-3">
          <Checkbox
            id="m-with-pay"
            label={t("new.withPayment")}
            checked={withPay}
            onChange={(e) => {
              setWithPay(e.target.checked);
              if (e.target.checked && !pay.taka && expected) setPay(emptyPayment(expected));
            }}
            data-testid="m-with-pay"
          />
          {withPay ? <PaymentFields id="m-pay" value={pay} onChange={setPay} backdate={canAdjust} max={expected} /> : null}
        </Card>
      ) : null}

      {problem ? (
        <Notice tone="error" action={problem.memberId ? <ButtonLink href={`/manage/${gymId}/members/${problem.memberId}`} size="sm">{t("new.openThatMember")}</ButtonLink> : undefined}>
          {problem.text}
        </Notice>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" busy={busy} confirm={Object.keys(problems).length ? undefined : "add"} data-testid="m-submit">
          {t("new.submit")}
        </Button>
        <ButtonLink href={`/manage/${gymId}/members`} variant="ghost">
          {t("cancel")}
        </ButtonLink>
      </div>
    </form>
  );
}
