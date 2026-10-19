"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { problemOf } from "@/lib/api/client";
import { finance, formatTaka, parseTaka } from "@/lib/admin/finance";
import { Button, Notice } from "../../ui";
import { Field, inputCls } from "./shared";

type Person = { id: string; displayName: string };

/** Pick an account by phone or name (admin user search). */
function PersonPicker({ label, value, onChange }: { label: string; value: Person | null; onChange: (p: Person | null) => void }) {
  const t = useTranslations("finance");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  async function search() {
    if (q.trim().length < 2) return;
    setBusy(true);
    try {
      setFound((await finance.findUser(q.trim())).data.map((u) => ({ id: u.id, displayName: u.displayName })));
    } catch {
      setFound([]);
    } finally {
      setBusy(false);
    }
  }
  if (value) {
    return (
      <Field label={label}>
        <span className="flex min-h-11 items-center gap-3 border-2 border-line px-3 text-ink">
          {value.displayName}
          <button type="button" className="ml-auto text-sm underline" onClick={() => onChange(null)}>
            {t("change")}
          </button>
        </span>
      </Field>
    );
  }
  return (
    <Field label={label}>
      <span className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPerson")} className={`${inputCls} w-56`} />
        <button type="button" onClick={() => void search()} disabled={busy} className="min-h-11 border-2 border-line px-3 font-semibold">
          {t("find")}
        </button>
      </span>
      {found.length ? (
        <ul className="mt-1 border-2 border-line">
          {found.map((p) => (
            <li key={p.id}>
              <button type="button" className="min-h-10 w-full px-3 text-left text-ink hover:bg-surface-2" onClick={() => onChange(p)}>
                {p.displayName} <span className="font-mono text-xs text-muted">{p.id.slice(0, 8)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Field>
  );
}

/**
 * Master test charge (dev and staging only): a real gateway payment with a chosen payer and payee,
 * held in escrow with a manual release. The payer pays from the link this returns (Phase 2 exit check).
 */
export function TestChargeTab({ max, onCreated }: { max: number; onCreated: () => void }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const qc = useQueryClient();
  const [payer, setPayer] = useState<Person | null>(null);
  const [payee, setPayee] = useState<Person | null>(null);
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ code: string; payUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const poisha = parseTaka(amount);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!payer || !payee || !poisha) return;
    setBusy(true);
    setError(null);
    try {
      const r = await finance.testCharge({ payerId: payer.id, payeeId: payee.id, amount: poisha });
      setResult({ code: r.payment.code, payUrl: r.payUrl });
      await qc.invalidateQueries({ queryKey: ["finance-payments"] });
    } catch (err) {
      setError(problemOf(err)?.title ?? t("loadFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 max-w-2xl space-y-4">
      <Notice>{t("testIntro", { max: formatTaka(max, locale) })}</Notice>
      <PersonPicker label={t("payer")} value={payer} onChange={setPayer} />
      <PersonPicker label={t("payee")} value={payee} onChange={setPayee} />
      <Field label={t("amountTaka")}>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={`${inputCls} w-36 tabular-nums`} />
      </Field>
      <Button type="submit" busy={busy} disabled={!payer || !payee || !poisha}>
        {t("createTestCharge")}
      </Button>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {result ? (
        <div className="border-2 border-brand p-4" data-testid="test-charge-result">
          <p className="font-bold">{t("testCreated", { code: result.code })}</p>
          <p className="mt-1 text-sm">{t("testLink")}</p>
          <a href={result.payUrl} className="mt-1 block break-all font-mono text-sm underline">
            {result.payUrl}
          </a>
          <button type="button" className="mt-3 text-sm font-semibold underline" onClick={onCreated}>
            {t("seePayments")}
          </button>
        </div>
      ) : null}
    </form>
  );
}
