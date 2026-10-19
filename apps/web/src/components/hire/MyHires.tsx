"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { hire, requestTone, TONE } from "@/lib/hire";
import { formatTaka } from "@/lib/payments";
import { MePanel } from "../MePanel";
import { Notice } from "../ui";
import { HireCard } from "./HireCard";

/** /me/hire (M11): the requests I sent as a manager (newest first) and my shortlist. */
export function MyHires() {
  const t = useTranslations("hire");
  const locale = useLocale();
  const { status } = useAuth();
  const q = useQuery({ queryKey: ["my-hires"], queryFn: () => hire.mine(), enabled: status === "signed_in" });
  const saved = useQuery({ queryKey: ["hire-shortlist"], queryFn: () => hire.shortlist(), enabled: status === "signed_in" });
  const when = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso)) : "");
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);

  if (status === "signed_out") return <MePanel />;
  return (
    <section className="mx-auto max-w-[1100px] px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{t("myHires")}</h1>
        <Link href="/hiring" className="min-h-11 border-2 border-line px-4 py-2 font-bold hover:border-brand">
          {t("findSomeone")}
        </Link>
      </div>
      {q.isPending ? (
        <div className="mt-6 h-40 animate-pulse bg-surface-2" />
      ) : q.isError ? (
        <div className="mt-6">
          <Notice tone="error">{t("error")}</Notice>
        </div>
      ) : !q.data?.items.length ? (
        <p className="mt-6 border-2 border-dashed border-line p-8 text-center font-semibold" data-testid="my-hires-empty">
          {t("noHires")}
        </p>
      ) : (
        <ul className="mt-6 divide-y-2 divide-line border-y-2 border-line" data-testid="my-hires">
          {q.data.items.map(({ request: r }) => (
            <li key={r.id}>
              <Link href={`/me/hire/${r.code}`} className="flex flex-wrap items-center gap-3 py-3 hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">
                    {r.other.name} · {name(r.profile.role)}
                  </span>
                  <span className="block text-sm text-muted">
                    {r.code} · {when(r.jobs[0]?.start ?? (r.quote as { lines?: { start: string }[] }).lines?.[0]?.start)}
                  </span>
                </span>
                <span className="font-bold tabular-nums">{formatTaka(r.money.total, locale)}</span>
                <span className={`border-2 px-2 py-0.5 text-sm font-bold ${TONE[requestTone(r.status)]}`}>{t(`requestStatus.${r.status}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {saved.data?.items.length ? (
        <div className="mt-10">
          <h2 className="text-xl font-extrabold">{t("shortlistTitle")}</h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {saved.data.items.map((c) => (
              <HireCard key={c.id} card={c} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
