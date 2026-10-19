"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { problemOf } from "@/lib/api/client";
import { dhakaTime, esports, takaOf, useUserEvents } from "@/lib/esports";
import { Button, Notice } from "../ui";
import { Chip, Empty, LinkButton } from "./bits";

type Item = Awaited<ReturnType<typeof esports.mine>>["items"][number] & {
  tournament: { id: string; slug: string; titleEn: string; titleBn: string; status: string; startsAt: string; entryUnit: string };
  matches: { id: string; seq: number; startsAt: string; status: string }[];
  payment: { id: string; payUrl: string } | null;
};

const REG_TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = { confirmed: "ok", checked_in: "ok", pending_payment: "warn", waitlisted: "muted", offered: "warn", no_show: "bad", disqualified: "bad", withdrawn: "muted", refunded: "muted" };

/** /me/matches: my entries — pay, accept an offer, check in, open the room, see results, withdraw. */
export function MyMatches() {
  const t = useTranslations("esports");
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["es-mine"], queryFn: () => esports.mine(), refetchInterval: 30_000 });
  const [msg, setMsg] = useState<{ id: string; text: string; tone: "info" | "error" } | null>(null);
  useUserEvents({ "esports.room_revealed": () => void qc.invalidateQueries({ queryKey: ["es-mine"] }) });

  const act = async (id: string, fn: () => Promise<unknown>, done: string) => {
    setMsg(null);
    try {
      const out = (await fn()) as { payment?: { payUrl: string } | null } | undefined;
      if (out && "payment" in out && out.payment) {
        window.location.assign(out.payment.payUrl);
        return;
      }
      setMsg({ id, text: done, tone: "info" });
      await qc.invalidateQueries({ queryKey: ["es-mine"] });
    } catch (err) {
      setMsg({ id, text: problemOf(err)?.title ?? t("failed"), tone: "error" });
    }
  };

  const items = (q.data?.items ?? []) as Item[];
  return (
    <section className="mx-auto max-w-[1000px] px-5 py-10">
      <h1 className="text-3xl font-extrabold">{t("myMatches")}</h1>
      {q.isPending ? <div className="mt-6 h-48 animate-pulse bg-surface-2" /> : null}
      {q.data && !items.length ? <Empty title={t("mine.empty")} action={<LinkButton href="/events">{t("home.browse")}</LinkButton>} /> : null}
      <ul className="mt-6 space-y-4" data-testid="my-entries">
        {items.map((r) => {
          const tt = r.tournament;
          const open = ["confirmed", "checked_in"].includes(r.status);
          return (
            <li key={r.id} className="border-2 border-line bg-surface p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/events/${tt.slug}`} className="text-lg font-extrabold underline-offset-2 hover:underline">
                  {locale === "bn" ? tt.titleBn : tt.titleEn}
                </Link>
                <Chip tone={REG_TONE[r.status] ?? "muted"}>{t(`regStatus.${r.status}`)}</Chip>
                {r.slotNo ? <span className="text-sm text-muted">{t("slotNo", { n: r.slotNo })}</span> : null}
                <span className="ml-auto text-sm text-muted">{dhakaTime(tt.startsAt, locale)}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {r.status === "pending_payment" && r.payment ? (
                  <a href={r.payment.payUrl} className="inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white hover:bg-brand-hover">
                    {t("payNow", { amount: takaOf(r.amount, locale) })}
                  </a>
                ) : null}
                {r.status === "offered" ? (
                  <Button type="button" onClick={() => void act(r.id, () => esports.acceptOffer(r.id), t("mine.offerTaken"))}>
                    {t("mine.takeSlot")}
                  </Button>
                ) : null}
                {r.status === "confirmed" && tt.status === "check_in" ? (
                  <Button type="button" onClick={() => void act(r.id, () => esports.checkIn(r.id), t("mine.checkedIn"))} data-testid="check-in">
                    {t("mine.checkIn")}
                  </Button>
                ) : null}
                {open
                  ? r.matches.map((m) => (
                      <span key={m.id} className="flex gap-2">
                        {["room_revealed", "live"].includes(m.status) || (r.status === "checked_in" && m.status === "room_ready") ? (
                          <LinkButton href={`/me/matches/${m.id}/room`} testId={`room-${m.seq}`}>
                            {t("mine.room", { n: m.seq })}
                          </LinkButton>
                        ) : null}
                        {["results_pending", "disputed", "final"].includes(m.status) ? (
                          <LinkButton href={`/me/matches/${m.id}/result`} tone="outline">
                            {t("mine.result", { n: m.seq })}
                          </LinkButton>
                        ) : null}
                      </span>
                    ))
                  : null}
                {["pending_payment", "confirmed", "waitlisted", "offered"].includes(r.status) && ["registration_open", "registration_closed", "check_in"].includes(tt.status) ? (
                  <button
                    type="button"
                    className="min-h-12 px-3 text-sm font-semibold text-danger underline"
                    onClick={() => {
                      if (window.confirm(t(tt.status === "registration_open" ? "mine.withdrawConfirm" : "mine.withdrawForfeit"))) void act(r.id, () => esports.withdraw(r.id), t("mine.withdrawn"));
                    }}
                  >
                    {t("mine.withdraw")}
                  </button>
                ) : null}
              </div>
              {r.status === "checked_in" ? <p className="mt-3 text-sm text-muted">{t("mine.roomSoon")}</p> : null}
              {msg?.id === r.id ? (
                <div className="mt-3">
                  <Notice tone={msg.tone}>{msg.text}</Notice>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
