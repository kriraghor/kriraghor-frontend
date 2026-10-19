"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { problemOf } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { newKey } from "@/lib/bookings";
import { orders, type Quote, type ShipTo } from "@/lib/orders";
import { formatTaka } from "@/lib/payments";
import { MePanel } from "../MePanel";
import { Button, Field, Notice } from "../ui";

/**
 * /shop/checkout (M13 FR-03 to FR-07): the delivery address (any delivery area in Bangladesh), the
 * server quote with a sub-order and a delivery fee per shop (৳80 Dhaka metro, ৳150 outside), then one
 * online payment on /pay/[id]. A price that moved since the quote is refused with the new total, which
 * the buyer confirms again. The shop sees the phone and address only after it accepts.
 */
export function CheckoutView() {
  const t = useTranslations("orders");
  const locale = useLocale();
  const { status } = useAuth();
  const [ship, setShip] = useState<ShipTo>({ name: "", phone: "", areaId: "", line: "", note: "" });
  const [changed, setChanged] = useState<Quote | null>(null);
  const areas = useQuery({ queryKey: ["delivery-areas"], queryFn: () => orders.areas(), enabled: status === "signed_in" });
  const quote = useQuery({ queryKey: ["quote", ship.areaId], queryFn: () => orders.quote(ship.areaId), enabled: status === "signed_in" && Boolean(ship.areaId), retry: false });
  const place = useMutation({
    mutationFn: (total: number) => orders.place(ship, total, newKey()),
    onSuccess: (r) => {
      if (r.payment) window.location.assign(r.payment.payUrl);
    },
    onError: (err) => {
      const p = problemOf(err) as (ReturnType<typeof problemOf> & { quote?: Quote }) | null;
      if (p?.code === "PRICE_CHANGED" && p.quote) setChanged(p.quote);
    },
  });
  const money = (n: number) => formatTaka(n, locale);
  if (status === "signed_out") return <MePanel />;

  const q = changed ?? quote.data;
  const set = (k: keyof ShipTo) => (e: { target: { value: string } }) => setShip({ ...ship, [k]: e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q) place.mutate(q.total);
  };
  const problem = place.error ? problemOf(place.error) : quote.error ? problemOf(quote.error) : null;
  const fieldError = (f: string) => problem?.errors?.find((x) => x.field === `ship.${f}` || x.field === f)?.message;
  const areaName = (a: { nameEn: string; nameBn: string }) => (locale === "bn" ? a.nameBn : a.nameEn);

  return (
    <section className="mx-auto max-w-[1100px] px-5 py-10" data-testid="checkout">
      <Link href="/shop/cart" className="text-sm font-semibold text-brand underline">
        ← {t("backToCart")}
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold">{t("checkoutTitle")}</h1>
      <form onSubmit={submit} className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <fieldset className="flex flex-col gap-4">
          <legend className="text-xl font-extrabold">{t("deliverTo")}</legend>
          <Field id="ship-name" label={t("shipName")} value={ship.name} onChange={set("name")} required autoComplete="name" error={fieldError("name")} />
          <Field id="ship-phone" label={t("shipPhone")} value={ship.phone} onChange={set("phone")} required type="tel" inputMode="tel" autoComplete="tel" hint={t("phoneHint")} error={fieldError("phone")} />
          <label htmlFor="ship-area" className="flex flex-col gap-1 font-semibold">
            {t("shipArea")}
            <select id="ship-area" value={ship.areaId} onChange={(e) => (setChanged(null), set("areaId")(e))} required className="min-h-12 border-2 border-line bg-surface px-3 font-normal" data-testid="ship-area">
              <option value="">{t("chooseArea")}</option>
              {(areas.data?.items ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {areaName(a)}
                </option>
              ))}
            </select>
          </label>
          <Field id="ship-line" label={t("shipLine")} value={ship.line} onChange={set("line")} required autoComplete="street-address" hint={t("lineHint")} error={fieldError("line")} />
          <Field id="ship-note" label={t("shipNote")} value={ship.note ?? ""} onChange={set("note")} />
          <p className="text-sm text-muted">{t("privacy")}</p>
        </fieldset>

        <aside className="h-fit border-2 border-line p-5" data-testid="order-summary">
          <h2 className="text-xl font-extrabold">{t("summary")}</h2>
          {!ship.areaId ? <p className="mt-3 text-sm text-muted">{t("pickAreaFirst")}</p> : null}
          {quote.isFetching && !q ? <div className="mt-3 h-24 animate-pulse bg-surface-2" /> : null}
          {q ? (
            <>
              <ul className="mt-3 divide-y-2 divide-line">
                {q.subOrders.map((s) => (
                  <li key={s.shop.id} className="py-3 text-sm" data-testid="summary-shop">
                    <p className="font-bold">{s.shop.name}</p>
                    {s.lines.map((l) => (
                      <p key={l.variantId} className="flex justify-between text-muted">
                        <span>
                          {l.qty} × {l.title} {locale === "bn" ? l.variantLabelBn : l.variantLabelEn}
                        </span>
                        <span>{money(l.lineTotal)}</span>
                      </p>
                    ))}
                    <p className="flex justify-between text-muted">
                      <span>{t("delivery")}</span>
                      <span>{money(s.delivery)}</span>
                    </p>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t-2 border-line pt-3 text-lg font-extrabold">
                <span>{t("total")}</span>
                <span data-testid="order-total">{money(q.total)}</span>
              </div>
              {q.changes.length ? <p className="mt-2 text-sm font-semibold">{t("pricesMoved")}</p> : null}
            </>
          ) : null}
          {changed ? (
            <div className="mt-3" role="alert">
              <Notice>{t("priceChanged", { total: money(changed.total) })}</Notice>
            </div>
          ) : null}
          {problem && problem.code !== "PRICE_CHANGED" && !problem.errors?.length ? (
            <div className="mt-3" role="alert">
              <Notice tone="error">{problem.code === "PHONE_REQUIRED" ? t("phoneRequired") : (problem.title ?? t("failed"))}</Notice>
              {problem.code === "PHONE_REQUIRED" ? (
                <Link href="/me/eligibility#phone" className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand underline">
                  {t("addPhone")}
                </Link>
              ) : null}
            </div>
          ) : null}
          <div className="mt-5">
            <Button busy={place.isPending} disabled={!q} data-testid="place-order">
              {q ? t("payTotal", { total: money(q.total) }) : t("pay")}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">{t("escrowNote")}</p>
        </aside>
      </form>
    </section>
  );
}
