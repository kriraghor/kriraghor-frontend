"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { dhakaTime, esports, useUserEvents, type Room } from "@/lib/esports";
import { Notice } from "../ui";

/**
 * /me/matches/[matchId]/room: the room ID and password for checked-in players, from the reveal time.
 * Every load is an audited view on the server; rotation arrives live (the old version is gone).
 * Never stored by the browser (no-store, nothing in localStorage).
 */
export function RoomView({ matchId }: { matchId: string }) {
  const t = useTranslations("esports");
  const locale = useLocale();
  const qc = useQueryClient();
  const [rotated, setRotated] = useState(false);
  const q = useQuery({ queryKey: ["es-room", matchId], queryFn: () => esports.room(matchId), retry: false, refetchInterval: (query) => (query.state.data ? false : 30_000), gcTime: 0 });
  useUserEvents({
    "esports.room_revealed": (data) => {
      if ((data as { matchId?: string }).matchId === matchId) qc.setQueryData(["es-room", matchId], (old: Room | undefined) => ({ ...(old ?? {}), ...(data as Room) }));
      void qc.invalidateQueries({ queryKey: ["es-room", matchId] });
    },
    "esports.room_rotated": (data) => {
      if ((data as { matchId?: string }).matchId !== matchId) return;
      setRotated(true);
      void qc.invalidateQueries({ queryKey: ["es-room", matchId] });
    },
  });

  const problem = q.error ? problemOf(q.error) : null;
  return (
    <section className="mx-auto max-w-xl px-5 py-10">
      <Link href="/me/matches" className="text-sm font-semibold text-brand underline">
        ← {t("myMatches")}
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold">{t("room.title")}</h1>
      {q.isPending ? <div className="mt-6 h-48 animate-pulse bg-surface-2" /> : null}
      {problem ? (
        <div className="mt-6">
          <Notice tone={problem.code === "ESPORTS_ROOM_NOT_REVEALED" ? "info" : "error"}>{problem.code === "ESPORTS_ROOM_NOT_REVEALED" ? t("room.notYet") : problem.title}</Notice>
        </div>
      ) : null}
      {q.data ? (
        <div className="mt-6 glass-strong rounded-[24px] p-6" data-testid="room-card">
          {rotated ? (
            <div className="mb-4">
              <Notice>{t("room.updated")}</Notice>
            </div>
          ) : null}
          <Secret label={t("room.id")} value={q.data.roomId} testId="room-id" />
          <Secret label={t("room.password")} value={q.data.password} testId="room-password" />
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">{t("room.map")}</dt>
              <dd className="font-bold">{q.data.map ? (locale === "bn" ? q.data.map.nameBn : q.data.map.nameEn) : "–"}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("room.starts")}</dt>
              <dd className="font-bold">{dhakaTime(q.data.startsAt, locale, { timeStyle: "short" })}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted">{t("room.rules", { version: q.data.version })}</p>
        </div>
      ) : null}
    </section>
  );
}

function Secret({ label, value, testId }: { label: string; value: string; testId: string }) {
  const t = useTranslations("esports");
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 flex items-center gap-3 border-b-2 border-line pb-3">
      <div className="flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="font-mono text-3xl font-bold tracking-wider" data-testid={testId}>
          {value}
        </p>
      </div>
      <button
        type="button"
        className="min-h-11 border-2 border-line-strong px-3 text-sm font-bold"
        onClick={async () => {
          await navigator.clipboard?.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? t("room.copied") : t("room.copy")}
      </button>
    </div>
  );
}
