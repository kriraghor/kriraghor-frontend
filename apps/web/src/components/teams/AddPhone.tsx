"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { problemOf } from "@/lib/api/client";
import { teams } from "@/lib/teams";
import { Button, Field, Notice } from "../ui";

/**
 * Add and verify a phone (M01, for accounts without one, e.g. a Google sign-up). Teams need a
 * verified phone, and invites sent to this number show up once it is verified.
 */
export function AddPhone({ onDone }: { onDone?: () => void }) {
  const t = useTranslations("teams");
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const start = useMutation({ mutationFn: () => teams.startPhone(phone), onSuccess: () => setSent(true) });
  const verify = useMutation({
    mutationFn: () => teams.verifyPhone(phone, code),
    onSuccess: () => {
      for (const key of ["me", "my-eligibility", "my-team-invites", "my-teams"]) qc.invalidateQueries({ queryKey: [key] });
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
