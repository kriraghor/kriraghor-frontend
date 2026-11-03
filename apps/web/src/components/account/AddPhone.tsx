"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { problemOf } from "@kriraghor/api-client";
import { players } from "@/lib/players";
import { Button, Field, Notice } from "@kriraghor/ui/primitives";

/**
 * Add and verify a phone (M01, for accounts without one, e.g. a Google sign-up). Booking, buying,
 * hiring, gyms, esports and posting a tournament all need a verified phone.
 */
export function AddPhone({ onDone }: { onDone?: () => void }) {
  const t = useTranslations("players");
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const start = useMutation({ mutationFn: () => players.startPhone(phone), onSuccess: () => setSent(true) });
  const verify = useMutation({
    mutationFn: () => players.verifyPhone(phone, code),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      onDone?.();
    },
  });
  const problem = problemOf(start.error ?? verify.error);
  const message = problem ? (["PHONE_IN_USE", "PHONE_ALREADY_VERIFIED", "PHONE_INVALID"].includes(problem.code) ? t(`errors.${problem.code}`) : (problem.title ?? t("failed"))) : null;

  return (
    <form
      id="phone"
      className="flex flex-col gap-3 glass-card p-4"
      data-testid="add-phone"
      onSubmit={(e) => {
        e.preventDefault();
        if (sent) verify.mutate();
        else start.mutate();
      }}
    >
      <h2 className="text-lg font-extrabold">{t("addPhone")}</h2>
      <p className="text-sm text-muted">{t("addPhoneWhy")}</p>
      <Field id="add-phone-number" label={t("phone")} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required disabled={sent} placeholder="01XXXXXXXXX" />
      {sent ? <Field id="add-phone-code" label={t("code")} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required hint={t("codeSent")} /> : null}
      {message ? <Notice tone="error">{message}</Notice> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" busy={start.isPending || verify.isPending}>
          {sent ? t("verify") : t("sendCode")}
        </Button>
        {sent ? (
          <button type="button" className="min-h-12 px-3 font-semibold underline" onClick={() => (setSent(false), setCode(""), verify.reset())}>
            {t("changeNumber")}
          </button>
        ) : null}
      </div>
    </form>
  );
}
