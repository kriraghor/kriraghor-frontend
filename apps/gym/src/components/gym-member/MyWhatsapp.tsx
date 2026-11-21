"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { WhatsappLogo } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { Button, Card, Notice, PhoneField, Skeleton, bdMobile, useConfirm, useToast } from "@kriraghor/ui/kit";
import { gymWhatsapp, type MyWhatsapp } from "@/lib/gym-whatsapp";
import { isNumberProblem, needsRecheck, numberOrNull } from "@/lib/whatsapp";
import { useGymError } from "@/components/gym-manage/common";
import { SwitchRow, localNumber } from "@/components/gym-manage/Whatsapp";

/**
 * "WhatsApp from this gym" on /me/memberships/[memberId] (M24-FR-159): my number for this gym (the phone
 * in the gym's record by default), receipts and reminders, news and offers. A member who agreed to an
 * older text is asked to check and save again. Hidden while it loads or when the read fails.
 */
export function MyWhatsappCard({ memberId, suspended }: { memberId: string; suspended: boolean }) {
  const q = useQuery({ queryKey: ["my-gym-wa", memberId], queryFn: () => gymWhatsapp.mine(memberId), retry: false });
  if (q.isPending) return <Skeleton className="h-48 rounded-card" />;
  if (!q.data) return null;
  return <Form memberId={memberId} w={q.data} suspended={suspended} />;
}

function Form({ memberId, w, suspended }: { memberId: string; w: MyWhatsapp; suspended: boolean }) {
  const t = useTranslations("gw");
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const ask = useConfirm();
  const [d, setD] = useState({ number: localNumber(w.number ?? w.phone), service: w.service, news: w.news });
  const [busy, setBusy] = useState(false);
  const [numberBad, setNumberBad] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const typed = numberOrNull(d.number);
    if (typed && !bdMobile.valid(typed)) return setNumberBad(true);
    if (!(await ask("save"))) return;
    setBusy(true);
    setProblem(null);
    try {
      // The phone in the gym's record is the default: sending it back unchanged keeps "no number of my own".
      const number = typed && w.phone && bdMobile.local(typed) === localNumber(w.phone) && !w.number ? null : typed;
      const saved = await gymWhatsapp.setMine(memberId, { number, service: d.service, news: d.news });
      qc.setQueryData(["my-gym-wa", memberId], saved);
      toast.show(t("saved"));
    } catch (e2) {
      if (isNumberProblem(problemOf(e2))) setNumberBad(true);
      else setProblem(err(e2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card padded={false} className="p-4" data-testid="me-whatsapp">
      <form onSubmit={save} className="flex flex-col gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <WhatsappLogo size={20} aria-hidden /> {t("me.title")}
          </h2>
          <p className="text-sm text-muted">{t("me.lead", { gym: w.gymName })}</p>
        </div>
        {needsRecheck(w) ? (
          <div data-testid="me-wa-recheck">
            <Notice tone="warning">{t("me.updated")}</Notice>
          </div>
        ) : null}
        <PhoneField
          id="me-wa-number"
          label={t("me.number")}
          value={d.number}
          onChange={(v) => {
            setD({ ...d, number: v });
            setNumberBad(false);
          }}
          placeholder="01XXXXXXXXX"
          hint={t("me.numberHint")}
          error={numberBad ? t("numberBad") : undefined}
          data-testid="me-wa-number"
        />
        <SwitchRow id="me-wa-service" label={t("consent.service")} hint={t("consent.serviceHint")} on={d.service} onChange={(v) => setD({ ...d, service: v })} disabled={suspended} testId="me-wa-service" />
        <SwitchRow id="me-wa-news" label={t("consent.news")} hint={t("consent.newsHint")} on={d.news} onChange={(v) => setD({ ...d, news: v })} disabled={suspended} testId="me-wa-news" />
        <p className="text-xs text-muted">{t("me.note")}</p>
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
        <Button type="submit" size="sm" variant="secondary" className="self-start" busy={busy} disabled={suspended} data-testid="me-wa-save">
          {t("save")}
        </Button>
      </form>
    </Card>
  );
}
