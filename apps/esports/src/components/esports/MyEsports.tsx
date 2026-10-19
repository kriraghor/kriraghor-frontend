"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { problemOf } from "@kriraghor/api-client";
import { esports } from "@/lib/esports";
import { Button, Field, Notice } from "@kriraghor/ui/primitives";
import { Chip } from "./bits";

type Game = { id: string; key: string; nameEn: string; nameBn: string; uidLabelEn?: string; uidLabelBn?: string; ignMaxLen?: number };
const TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = { verified: "ok", pending: "warn", rejected: "bad", banned: "bad" };

/** /me/esports: my game UIDs (with a screenshot, reviewed by staff) and my squads. */
export function MyEsports() {
  const t = useTranslations("esports");
  const locale = useLocale();
  const qc = useQueryClient();
  const games = useQuery({ queryKey: ["es-games"], queryFn: () => esports.games() });
  const profiles = useQuery({ queryKey: ["es-profiles"], queryFn: () => esports.profiles() });
  const squads = useQuery({ queryKey: ["es-squads"], queryFn: () => esports.squads() });
  const gameList = (games.data?.items ?? []) as Game[];
  const gameName = (id: string) => {
    const g = gameList.find((x) => x.id === id);
    return g ? (locale === "bn" ? g.nameBn : g.nameEn) : "";
  };
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["es-profiles"] });
    void qc.invalidateQueries({ queryKey: ["es-squads"] });
  };

  return (
    <section className="mx-auto max-w-[1100px] px-5 py-10">
      <h1 className="text-3xl font-extrabold">{t("me.title")}</h1>
      <p className="mt-2 max-w-[60ch] text-muted">{t("me.lead")}</p>

      <h2 className="mt-8 text-xl font-extrabold">{t("me.uids")}</h2>
      <ul className="mt-3 glass-card divide-y divide-[var(--glass-edge)] px-4" data-testid="my-uids">
        {(profiles.data?.items ?? []).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="font-bold">{gameName(p.gameId)}</span>
            <span>{p.ign}</span>
            <span className="font-mono text-sm text-muted">{p.uid}</span>
            <span className="ml-auto">
              <Chip tone={TONE[p.status] ?? "muted"}>{t(`uidStatus.${p.status}`)}</Chip>
            </span>
            {p.status === "rejected" && (p as { rejectReason?: string | null }).rejectReason ? <p className="w-full text-sm text-danger">{t("me.rejected", { reason: String((p as { rejectReason?: string }).rejectReason).replace(/_/g, " ") })}</p> : null}
          </li>
        ))}
        {profiles.data && !profiles.data.items.length ? <li className="py-4 text-muted">{t("me.noUids")}</li> : null}
      </ul>
      <AddUid games={gameList} taken={(profiles.data?.items ?? []).filter((p) => ["pending", "verified", "banned"].includes(p.status)).map((p) => p.gameId)} onDone={refresh} />

      <h2 className="mt-10 text-xl font-extrabold">{t("squads.title")}</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {(squads.data?.items ?? []).map((s) => (
          <SquadCard key={s.id} squad={s as SquadView} gameName={gameName(s.gameId)} onChange={refresh} />
        ))}
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <CreateSquad games={gameList.filter((g) => (profiles.data?.items ?? []).some((p) => p.gameId === g.id && p.status === "verified"))} onDone={refresh} />
        <JoinSquad onDone={refresh} />
      </div>
    </section>
  );
}

function AddUid({ games, taken, onDone }: { games: Game[]; taken: string[]; onDone: () => void }) {
  const t = useTranslations("esports");
  const locale = useLocale();
  const free = games.filter((g) => !taken.includes(g.id));
  const [gameId, setGameId] = useState("");
  const [uid, setUid] = useState("");
  const [ign, setIgn] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  if (!free.length) return null;
  const g = free.find((x) => x.id === gameId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!gameId || !file) return setError(t("me.needAll"));
    setBusy(true);
    setError(null);
    try {
      const up = await esports.upload(file);
      await esports.addProfile({ gameId, uid: uid.trim(), ign: ign.trim(), screenshotKey: up.key });
      setOk(true);
      setUid("");
      setIgn("");
      setFile(null);
      onDone();
    } catch (err) {
      setError(problemOf(err)?.title ?? t("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-4 glass-card p-5 md:grid-cols-2" data-testid="add-uid">
      <p className="font-bold md:col-span-2">{t("me.addUid")}</p>
      <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
        {t("me.game")}
        <select value={gameId} onChange={(e) => setGameId(e.target.value)} className="min-h-12 field px-3 text-base text-ink" required>
          <option value="">{t("me.chooseGame")}</option>
          {free.map((x) => (
            <option key={x.id} value={x.id}>
              {locale === "bn" ? x.nameBn : x.nameEn}
            </option>
          ))}
        </select>
      </label>
      <Field id="uid" label={g ? (locale === "bn" ? g.uidLabelBn ?? "UID" : g.uidLabelEn ?? "UID") : "UID"} value={uid} onChange={(e) => setUid(e.target.value)} inputMode="numeric" autoComplete="off" required />
      <Field id="ign" label={t("me.ign")} value={ign} onChange={(e) => setIgn(e.target.value)} maxLength={g?.ignMaxLen ?? 40} required />
      <div className="flex flex-col gap-1">
        <label htmlFor="shot" className="text-sm font-semibold text-muted">
          {t("me.screenshot")}
        </label>
        <input id="shot" type="file" accept="image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="min-h-12 field px-3 py-2 text-sm" required />
        <p className="text-xs text-muted">{t("me.screenshotHint")}</p>
      </div>
      <div className="md:col-span-2">
        {error ? <Notice tone="error">{error}</Notice> : ok ? <Notice>{t("me.sent")}</Notice> : null}
        <div className="mt-3">
          <Button type="submit" busy={busy}>
            {t("me.send")}
          </Button>
        </div>
      </div>
    </form>
  );
}

type SquadView = { id: string; gameId: string; name: string; tag: string; captainUserId: string; inviteCode: string | null; myStatus?: string; myMemberId?: string; maxMembers?: number; members: { userId: string; ign: string | null; username: string | null; role: string; status: string }[] };

function SquadCard({ squad, gameName, onChange }: { squad: SquadView; gameName: string; onChange: () => void }) {
  const t = useTranslations("esports");
  const [username, setUsername] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>) => {
    setMsg(null);
    try {
      await fn();
      onChange();
    } catch (err) {
      setMsg(problemOf(err)?.title ?? t("failed"));
    }
  };
  if (squad.myStatus === "invited") {
    return (
      <div className="border-2 border-amber-500 bg-surface p-4">
        <p className="font-bold">{t("squads.invitedTo", { name: squad.name })}</p>
        <div className="mt-3 flex gap-2">
          <Button type="button" onClick={() => void act(() => esports.respond(squad.myMemberId!, true))}>
            {t("squads.accept")}
          </Button>
          <button type="button" className="min-h-12 border-2 border-line px-4 font-bold" onClick={() => void act(() => esports.respond(squad.myMemberId!, false))}>
            {t("squads.decline")}
          </button>
        </div>
        {msg ? <p className="mt-2 text-sm text-danger">{msg}</p> : null}
      </div>
    );
  }
  return (
    <div className="glass-card p-4">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-lg font-extrabold">[{squad.tag}]</span>
        <span className="font-bold">{squad.name}</span>
        <span className="ml-auto text-xs text-muted">{gameName}</span>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {squad.members.map((m) => (
          <li key={m.userId} className="flex items-center gap-2">
            <span className="font-semibold">{m.ign ?? m.username ?? "—"}</span>
            {m.role === "captain" ? <Chip tone="ok">{t("squads.captain")}</Chip> : null}
            {m.status === "invited" ? <Chip>{t("squads.invited")}</Chip> : null}
          </li>
        ))}
      </ul>
      {squad.inviteCode ? (
        <p className="mt-3 text-sm">
          {t("squads.code")} <code className="bg-surface-2 px-2 py-1 font-mono font-bold">{squad.inviteCode}</code>
        </p>
      ) : null}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void act(() => esports.invite(squad.id, username.trim())).then(() => setUsername(""));
        }}
      >
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("squads.username")} aria-label={t("squads.username")} className="min-h-11 flex-1 field px-3" />
        <button type="submit" className="min-h-11 border-2 border-line-strong px-3 text-sm font-bold">
          {t("squads.invite")}
        </button>
      </form>
      <button type="button" onClick={() => void act(() => esports.leave(squad.id))} className="mt-3 text-sm font-semibold text-danger underline">
        {t("squads.leave")}
      </button>
      {msg ? <p className="mt-2 text-sm text-danger">{msg}</p> : null}
    </div>
  );
}

function CreateSquad({ games, onDone }: { games: Game[]; onDone: () => void }) {
  const t = useTranslations("esports");
  const locale = useLocale();
  const [gameId, setGameId] = useState("");
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!games.length) return <p className="text-sm text-muted">{t("squads.needUid")}</p>;
  return (
    <form
      className="grid gap-3 glass-card p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await esports.createSquad({ gameId, name: name.trim(), tag: tag.trim() });
          setName("");
          setTag("");
          onDone();
        } catch (err) {
          setError(problemOf(err)?.title ?? t("failed"));
        }
      }}
    >
      <p className="font-bold">{t("squads.create")}</p>
      <select value={gameId} onChange={(e) => setGameId(e.target.value)} aria-label={t("me.game")} className="min-h-12 field px-3" required>
        <option value="">{t("me.chooseGame")}</option>
        {games.map((g) => (
          <option key={g.id} value={g.id}>
            {locale === "bn" ? g.nameBn : g.nameEn}
          </option>
        ))}
      </select>
      <Field id="sq-name" label={t("squads.name")} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
      <Field id="sq-tag" label={t("squads.tag")} value={tag} onChange={(e) => setTag(e.target.value)} maxLength={8} pattern="[A-Za-z0-9]{2,8}" required />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="submit">{t("squads.create")}</Button>
    </form>
  );
}

function JoinSquad({ onDone }: { onDone: () => void }) {
  const t = useTranslations("esports");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid content-start gap-3 glass-card p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await esports.joinSquad(code.trim());
          setCode("");
          onDone();
        } catch (err) {
          setError(problemOf(err)?.title ?? t("failed"));
        }
      }}
    >
      <p className="font-bold">{t("squads.join")}</p>
      <Field id="sq-code" label={t("squads.code")} value={code} onChange={(e) => setCode(e.target.value)} maxLength={12} required />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="submit">{t("squads.join")}</Button>
    </form>
  );
}
