"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { esportsAdmin } from "@/lib/admin/esports";
import { formatTaka } from "@/lib/admin/finance";
import { formatDhaka } from "../useAdminMe";

/**
 * Moderation desk panels for the M21 kinds. game_profile: the player's UID and IGN against their
 * in-game screenshot (fetched only when the reviewer asks; each fetch is an audited view).
 * esports_tournament: the snapshot that was submitted (prize table, fee, slots, schedule).
 */
export function GameProfilePanel({ payload }: { payload: Record<string, unknown> }) {
  const t = useTranslations("esportsDesk.panel");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (ref.current) URL.revokeObjectURL(ref.current);
    },
    []
  );
  async function show() {
    setBusy(true);
    setFailed(false);
    try {
      const u = URL.createObjectURL(await esportsAdmin.screenshot(String(payload.profileId)));
      ref.current = u;
      setUrl(u);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-6 grid gap-4 border-t-2 border-line pt-4 sm:grid-cols-[1fr_minmax(0,1fr)]" data-testid="game-profile-panel">
      <dl className="grid content-start gap-2 text-sm">
        <dt className="text-muted">{t("game")}</dt>
        <dd className="font-semibold uppercase">{String(payload.gameKey ?? "–")}</dd>
        <dt className="text-muted">{t("uid")}</dt>
        <dd className="font-mono text-lg font-bold">{String(payload.uid ?? "–")}</dd>
        <dt className="text-muted">{t("ign")}</dt>
        <dd className="text-lg font-bold">{String(payload.ign ?? "–")}</dd>
        <dd className="text-xs text-muted">{t("compare")}</dd>
      </dl>
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 border-2 border-line p-2 text-center text-sm">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={t("screenshot")} className="max-h-96 w-full object-contain" data-testid="uid-screenshot" />
        ) : (
          <button type="button" disabled={busy} onClick={() => void show()} className="min-h-11 border-2 border-line px-3 font-semibold disabled:opacity-50">
            {t("showScreenshot")}
          </button>
        )}
        {failed ? <span className="text-xs text-danger">{t("failed")}</span> : null}
      </div>
    </div>
  );
}

type TournamentPayload = { gameKey?: string; modeKey?: string; entryUnit?: string; entryFee?: number; maxSlots?: number; minParticipants?: number; prizes?: { place: number; amount: number }[]; prizePool?: number; killReward?: number; maxPaidKills?: number | null; organisationId?: string | null; organiserName?: string | null; matches?: number; registrationOpensAt?: string; startsAt?: string };

export function TournamentPanel({ payload }: { payload: Record<string, unknown> }) {
  const t = useTranslations("esportsDesk.panel");
  const locale = useLocale();
  const p = payload as TournamentPayload;
  const money = (v: number | undefined) => formatTaka(v ?? 0, locale);
  // What the fees could collect at full slots against what the table promises (the platform covers a shortfall).
  const fullCollect = (p.entryFee ?? 0) * (p.maxSlots ?? 0);
  // M22: an organiser's pool (places + kill reward × the kill cap) is paid in before review; no subsidy.
  const organised = Boolean(p.organisationId);
  const fund = (p.prizePool ?? 0) + (p.killReward ?? 0) * (p.maxPaidKills ?? 0);
  return (
    <div className="mt-6 border-t-2 border-line pt-4" data-testid="tournament-panel">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Item label={t("game")} value={`${p.gameKey ?? "–"} · ${p.modeKey ?? "–"}`} />
        <Item label={t("unit")} value={t(`unitKind.${p.entryUnit === "squad" ? "squad" : "player"}`)} />
        <Item label={t("fee")} value={p.entryFee ? money(p.entryFee) : t("free")} />
        <Item label={t("slots")} value={`${p.minParticipants ?? "–"}–${p.maxSlots ?? "–"}`} />
        <Item label={t("opens")} value={p.registrationOpensAt ? formatDhaka(p.registrationOpensAt, locale) : "–"} />
        <Item label={t("starts")} value={p.startsAt ? formatDhaka(p.startsAt, locale) : "–"} />
        <Item label={t("matches")} value={String(p.matches ?? "–")} />
        <Item label={t("killReward")} value={p.killReward ? money(p.killReward) : "–"} />
        {organised ? <Item label={t("organiser")} value={p.organiserName ?? "–"} /> : null}
        {organised && p.maxPaidKills ? <Item label={t("maxPaidKills")} value={String(p.maxPaidKills)} /> : null}
      </dl>
      <h4 className="mt-4 font-bold">{t("prizes", { pool: money(p.prizePool) })}</h4>
      <ol className="mt-1 divide-y divide-line border-y border-line text-sm">
        {(p.prizes ?? []).map((x) => (
          <li key={x.place} className="flex py-1.5">
            <span>#{x.place}</span>
            <span className="ml-auto font-bold tabular-nums">{money(x.amount)}</span>
          </li>
        ))}
      </ol>
      {organised ? (
        <p className="mt-2 text-sm font-semibold" data-testid="organiser-fund">
          {t("fund", { fund: money(fund) })}
        </p>
      ) : (p.prizePool ?? 0) > fullCollect ? (
        <p className="mt-2 text-sm font-semibold text-danger">{t("subsidy", { gap: money((p.prizePool ?? 0) - fullCollect) })}</p>
      ) : null}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
