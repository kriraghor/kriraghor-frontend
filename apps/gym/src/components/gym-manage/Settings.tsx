"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button, Card, Checkbox, Field, Notice, Select, Skeleton, Textarea, useToast } from "@kriraghor/ui/kit";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { draftOf, featureLocked, gymManage, settingsPatch, SHORT_CODE, vatBpsOf, type GymSettings, type SettingsDraft as Draft } from "@/lib/gym-manage";
import { GymPage, Upsell, useGymError, type GymCtx } from "./common";
import { RemoveGym } from "./RemoveGym";

/**
 * /manage/[gymId]/settings (owner; M24 §4.1, §6.8): the short code for member codes and receipts
 * (unique among the owner's gyms; the first save sets the gym up), TIN and BIN (printed on receipts
 * only when entered), the receipt footer, the entry policy for expired, frozen, unpaid or package-less
 * members (allow, warn, block with the owner's override), absent alert days and join requests, VAT, free
 * trial visits (M24-FR-109: on or off, the daily cap, visits per person, a note for guests); at the foot,
 * the owner removes the gym (M20-FR-15).
 */
export function Settings({ gymId }: { gymId: string }) {
  const t = useTranslations("gm");
  return (
    <GymPage gymId={gymId} page="settings" title={t("settings.title")} testId="gm-settings">
      {(ctx) => (
        <div className="flex flex-col gap-8">
          <Form ctx={ctx} />
          <RemoveGym ctx={ctx} />
        </div>
      )}
    </GymPage>
  );
}

function Form({ ctx }: { ctx: GymCtx }) {
  const err = useGymError();
  const q = useQuery({ queryKey: ["gm-settings", ctx.gymId], queryFn: () => gymManage.settings(ctx.gymId) });
  if (q.isPending) return <Skeleton className="h-64 rounded-card" />;
  if (q.isError || !q.data) return <Notice tone="error">{err(q.error)}</Notice>;
  return <Fields ctx={ctx} s={q.data} />;
}

function Fields({ ctx, s }: { ctx: GymCtx; s: GymSettings }) {
  const t = useTranslations("gm");
  const tv = useTranslations("gv");
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const [d, setD] = useState<Draft>(() => draftOf(s));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const codeOk = SHORT_CODE.test(d.shortCode.trim().toUpperCase());
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setProblem(null);
    if (!codeOk) return setProblem(t("settings.codeHint"));
    if (d.absentAlertDays.trim() && !/^\d{1,3}$/.test(d.absentAlertDays.trim())) return setProblem(t("settings.daysBad"));
    const vat = d.vatPct.trim() ? vatBpsOf(d.vatPct) : null;
    if (d.vatPct.trim() && (vat == null || vat > s.vatMaxBps)) return setProblem(t("settings.vatBad", { max: s.vatMaxBps / 100 }));
    if (d.vatEnabled && vat == null) return setProblem(t("settings.vatNeeded"));
    const cap = d.visitDailyCap.trim();
    if (cap && (!/^\d{1,4}$/.test(cap) || Number(cap) < 1 || Number(cap) > (s.visitDailyCapMax ?? 50))) return setProblem(tv("settings.capBad", { max: s.visitDailyCapMax ?? 50 }));
    const body = settingsPatch(s, d);
    if (!Object.keys(body).length) return toast.show(t("settings.nothing"), "info");
    setBusy(true);
    try {
      const saved = await gymManage.saveSettings(ctx.gymId, body);
      qc.setQueryData(["gm-settings", ctx.gymId], saved);
      setD(draftOf(saved));
      await qc.invalidateQueries({ queryKey: ["manage-gyms"] });
      await qc.invalidateQueries({ queryKey: ["gm-overview", ctx.gymId] });
      toast.show(t("saved"));
    } catch (e2) {
      setProblem(err(e2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="flex flex-col gap-4" data-testid="settings-form">
      {!s.setupDone ? <Notice tone="warning" title={t("gyms.setupTitle")}>{t("settings.firstSave")}</Notice> : null}
      <Card className="grid gap-3 sm:grid-cols-2">
        <h2 className="font-display text-lg font-bold sm:col-span-2">{t("settings.codes")}</h2>
        <Field
          id="s-code"
          label={t("settings.shortCode")}
          value={d.shortCode}
          maxLength={6}
          autoCapitalize="characters"
          onChange={(e) => setD({ ...d, shortCode: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })}
          hint={s.nextMemberCode ? t("settings.nextCode", { code: s.nextMemberCode }) : t("settings.codeHint")}
          error={d.shortCode && !codeOk ? t("settings.codeHint") : undefined}
          data-testid="s-code"
        />
        <div className="text-sm text-muted sm:pt-7">{s.setupDone ? t("settings.codeChange") : null}</div>
        <Field id="s-tin" label={t("settings.tin")} optional={t("optional")} value={d.tin} maxLength={20} onChange={(e) => setD({ ...d, tin: e.target.value })} />
        <Field id="s-bin" label={t("settings.bin")} optional={t("optional")} value={d.bin} maxLength={20} onChange={(e) => setD({ ...d, bin: e.target.value })} />
        <Textarea id="s-footer" label={t("settings.footer")} optional={t("optional")} value={d.receiptFooter} maxLength={200} onChange={(e) => setD({ ...d, receiptFooter: e.target.value })} className="sm:col-span-2" hint={t("settings.footerHint")} />
      </Card>
      <Card className="grid gap-3 sm:grid-cols-2">
        <h2 className="font-display text-lg font-bold sm:col-span-2">{t("settings.entry")}</h2>
        <Select id="s-policy" label={t("settings.policy")} value={d.entryPolicy} onChange={(e) => setD({ ...d, entryPolicy: e.target.value as Draft["entryPolicy"] })} hint={t(`settings.policyHint.${d.entryPolicy}`)} data-testid="s-policy">
          {(["allow", "warn", "block"] as const).map((p) => (
            <option key={p} value={p}>
              {t(`settings.policyOption.${p}`)}
            </option>
          ))}
        </Select>
        <Field id="s-absent" label={t("settings.absentDays")} optional={t("settings.default", { n: s.absentAlertDaysDefault })} inputMode="numeric" value={d.absentAlertDays} onChange={(e) => setD({ ...d, absentAlertDays: e.target.value })} />
        <Checkbox id="s-join" label={t("settings.joinRequests")} checked={d.joinRequestsOpen} onChange={(e) => setD({ ...d, joinRequestsOpen: e.target.checked })} className="sm:col-span-2" />
      </Card>
      <Card className="grid gap-3 sm:grid-cols-2" data-testid="settings-vat">
        <h2 className="font-display text-lg font-bold sm:col-span-2">{t("settings.vat")}</h2>
        <p className="text-sm text-muted sm:col-span-2">{t("settings.vatHint")}</p>
        <Checkbox id="s-vat-on" label={t("settings.vatOn")} checked={d.vatEnabled} onChange={(e) => setD({ ...d, vatEnabled: e.target.checked })} className="sm:col-span-2" />
        {d.vatEnabled ? (
          <Field id="s-vat" label={t("settings.vatRate")} inputMode="decimal" value={d.vatPct} onChange={(e) => setD({ ...d, vatPct: e.target.value })} hint={t("settings.vatRateHint", { max: s.vatMaxBps / 100 })} data-testid="s-vat" />
        ) : null}
        {d.vatEnabled && !d.bin.trim() ? (
          <Notice tone="warning" className="sm:col-span-2">
            {t("settings.vatBin")}
          </Notice>
        ) : null}
      </Card>
      <Visits ctx={ctx} s={s} d={d} setD={setD} />
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" busy={busy} data-testid="settings-save">
          {t("save")}
        </Button>
        <Link href={`/manage/${ctx.gymId}/packages`} className="text-sm font-semibold underline">
          {t("nav.packages")}
        </Link>
        <Link href={`/manage/${ctx.gymId}/edit`} className="text-sm font-semibold underline">
          {t("nav.edit")}
        </Link>
      </div>
    </form>
  );
}

/** Free trial visits (M24-FR-109, 9 Nov 2026): Basic plans and up; an Upsell below. */
function Visits({ ctx, s, d, setD }: { ctx: GymCtx; s: GymSettings; d: Draft; setD: (d: Draft) => void }) {
  const t = useTranslations("gv");
  const locked = featureLocked(ctx.gym.features, "visits");
  const perMax = s.visitPerPersonMax ?? 3;
  return (
    <Card className="grid gap-3 sm:grid-cols-2" data-testid="settings-visits">
      <h2 className="font-display text-lg font-bold sm:col-span-2">{t("settings.title")}</h2>
      <p className="text-sm text-muted sm:col-span-2">{t("settings.lead")}</p>
      {locked ? (
        <Upsell feature="visits" owner className="sm:col-span-2" />
      ) : (
        <>
          <Checkbox id="s-visits" label={t("settings.open")} checked={d.visitsOpen} onChange={(e) => setD({ ...d, visitsOpen: e.target.checked })} className="sm:col-span-2" data-testid="s-visits-open" />
          <Field
            id="s-visit-cap"
            label={t("settings.cap")}
            optional={t("settings.capDefault", { n: s.visitDailyCapDefault ?? 5 })}
            inputMode="numeric"
            value={d.visitDailyCap}
            onChange={(e) => setD({ ...d, visitDailyCap: e.target.value.replace(/\D/g, "") })}
            hint={t("settings.capHint", { max: s.visitDailyCapMax ?? 50 })}
            data-testid="s-visit-cap"
          />
          <Select id="s-visit-each" label={t("settings.each")} value={d.visitPerPerson} onChange={(e) => setD({ ...d, visitPerPerson: e.target.value })} hint={t("settings.eachHint")} data-testid="s-visit-each">
            {Array.from({ length: perMax }, (_, i) => String(i + 1)).map((n) => (
              <option key={n} value={n}>
                {t("settings.eachOption", { n: Number(n) })}
              </option>
            ))}
          </Select>
          <Textarea id="s-visit-note" label={t("settings.note")} optional={t("settings.optional")} value={d.visitNote} maxLength={300} onChange={(e) => setD({ ...d, visitNote: e.target.value })} className="sm:col-span-2" hint={t("settings.noteHint")} data-testid="s-visit-note" />
          <p className="text-sm text-muted sm:col-span-2">{t("settings.noFee")}</p>
        </>
      )}
    </Card>
  );
}
