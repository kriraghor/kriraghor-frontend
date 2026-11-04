"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { sortMembers, teams, whatsappUrl, type Team } from "@/lib/teams";
import { MePanel } from "../MePanel";
import { Button, Field, Notice } from "@kriraghor/ui/primitives";

const LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_LOGO = 2 * 1024 * 1024;

/**
 * /me/teams/[id] (M16 §16): the team. Members show the NID ✓ only (never DOB, gender or phone).
 * The captain and vice-captain invite by phone: the answer is the same for every number and always
 * comes with a share link to send on WhatsApp, because Kriraghor sends no SMS to a number without an
 * account. The captain sets the vice-captain and jersey numbers, hands over, edits, archives.
 */
export function TeamView({ id }: { id: string }) {
  const t = useTranslations("teams");
  const locale = useLocale();
  const { status } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const q = useQuery({ queryKey: ["team", id], queryFn: () => teams.get(id), enabled: status === "signed_in" });
  const [phone, setPhone] = useState("");
  const [share, setShare] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<null | "archive" | "leave" | { handOver: string; name: string }>(null);
  const [edit, setEdit] = useState<{ name: string; shortCode: string } | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  const done = (team: Team) => {
    qc.setQueryData(["team", id], team);
    qc.invalidateQueries({ queryKey: ["my-teams"] });
  };
  const act = useMutation({
    mutationFn: async (fn: () => Promise<Team>) => fn(),
    onSuccess: (team) => {
      done(team);
      setConfirm(null);
      setEdit(null);
    },
  });
  const invite = useMutation({
    mutationFn: () => teams.invite(id, phone),
    onSuccess: (r) => {
      setShare(r.shareUrl);
      setCopied(false);
      setPhone("");
      qc.invalidateQueries({ queryKey: ["team", id] });
    },
  });
  const inviteAct = useMutation({
    mutationFn: async ({ inviteId, kind }: { inviteId: string; kind: "resend" | "cancel" }): Promise<{ shareUrl?: string }> => (kind === "resend" ? teams.resendInvite(id, inviteId) : (await teams.cancelInvite(id, inviteId), {})),
    onSuccess: (r) => {
      if (r.shareUrl) setShare(r.shareUrl);
      qc.invalidateQueries({ queryKey: ["team", id] });
    },
  });
  const leave = useMutation({
    mutationFn: () => teams.leave(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-teams"] });
      router.push("/me/teams");
    },
  });

  if (status === "signed_out") return <MePanel />;
  if (q.isPending) return <div className="mx-auto mt-10 h-96 max-w-[1100px] animate-pulse bg-surface-2" />;
  if (q.isError || !q.data)
    return (
      <section className="mx-auto max-w-[640px] px-5 py-16">
        <h1 className="text-2xl font-extrabold">{t("teamNotFound")}</h1>
        <Link href="/me/teams" className="mt-3 inline-block font-semibold text-brand underline">
          {t("myTeams")}
        </Link>
      </section>
    );

  const team = q.data;
  const sport = team.sport ? (locale === "bn" ? team.sport.nameBn : team.sport.nameEn) : "–";
  const err = (e: unknown) => {
    const p = problemOf(e);
    return p ? (t.has(`errors.${p.code}`) ? t(`errors.${p.code}`) : (p.title ?? t("failed"))) : null;
  };
  const failure = err(act.error) ?? err(inviteAct.error) ?? err(leave.error);
  const date = (iso: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Dhaka" }).format(new Date(iso));
  const shareText = share ? t("shareText", { team: team.name, url: share }) : "";
  const isCaptain = team.myRole === "captain";

  return (
    <section className="mx-auto max-w-[1100px] px-5 py-10">
      <Link href="/me/teams" className="text-sm font-semibold text-brand underline">
        ← {t("myTeams")}
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {team.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logoUrl} alt={t("logoOf", { team: team.name })} className="size-20 border-2 border-line object-cover" />
        ) : (
          <span className="grid size-20 place-items-center border-2 border-line text-2xl font-extrabold" aria-hidden>
            {team.shortCode ?? team.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            {sport}
            {team.shortCode ? ` · ${team.shortCode}` : ""}
          </p>
          <h1 className="text-3xl font-extrabold" data-testid="team-name">
            {team.name}
          </h1>
          <p className="text-sm text-muted">{t("yourRole", { role: t(`role.${team.myRole}`) })}</p>
        </div>
        {team.status === "archived" ? <span className="border-2 border-line px-2 py-0.5 font-bold text-muted">{t("archived")}</span> : null}
      </div>

      {failure ? (
        <div className="mt-4">
          <Notice tone="error">{failure}</Notice>
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <h2 className="text-xl font-extrabold">{t("members")}</h2>
          <ul className="mt-3 glass-card divide-y divide-[var(--glass-edge)] px-4" data-testid="team-members">
            {sortMembers(team.members).map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center gap-3 py-3" data-testid="team-member">
                <span className="grid size-10 place-items-center border-2 border-line font-mono font-bold tabular-nums" aria-label={t("jersey")}>
                  {m.jerseyNo ?? "–"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{m.username ? <Link href={`/players/${m.username}`}>{m.displayName}</Link> : m.displayName}</span>
                  <span className="block text-sm text-muted">
                    {t(`role.${m.role}`)} · {t("joined", { date: date(m.joinedAt) })}
                  </span>
                </span>
                <span className={`border-2 px-2 py-0.5 text-sm font-bold ${m.nidVerified ? "border-brand text-brand" : "border-line text-muted"}`} data-testid="member-nid">
                  {m.nidVerified ? t("nidVerified") : t("nidNotVerified")}
                </span>
                {team.can.manage && m.role !== "captain" ? (
                  <span className="flex flex-wrap gap-2">
                    <button type="button" className="min-h-11 border-2 border-line px-3 text-sm font-bold hover:border-brand" onClick={() => act.mutate(() => teams.setMember(id, m.userId, { role: m.role === "vice_captain" ? "player" : "vice_captain" }))}>
                      {m.role === "vice_captain" ? t("makePlayer") : t("makeVice")}
                    </button>
                    <button
                      type="button"
                      className="min-h-11 border-2 border-line px-3 text-sm font-bold hover:border-brand"
                      onClick={() => {
                        const raw = window.prompt(t("jerseyPrompt", { name: m.displayName }), m.jerseyNo?.toString() ?? "");
                        if (raw === null) return;
                        const n = raw.trim() === "" ? null : Number(raw);
                        if (n !== null && (!Number.isInteger(n) || n < 0 || n > 999)) return;
                        act.mutate(() => teams.setMember(id, m.userId, { jerseyNo: n }));
                      }}
                    >
                      {t("setJersey")}
                    </button>
                    <button type="button" className="min-h-11 border-2 border-line px-3 text-sm font-bold hover:border-brand" onClick={() => setConfirm({ handOver: m.userId, name: m.displayName })}>
                      {t("handOver")}
                    </button>
                  </span>
                ) : null}
                {team.can.invite && m.role !== "captain" && !(m.role === "vice_captain" && !isCaptain) ? (
                  <button type="button" className="min-h-11 border-2 border-line px-3 text-sm font-bold hover:border-danger" onClick={() => act.mutate(() => teams.remove(id, m.userId))}>
                    {t("remove")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          {typeof confirm === "object" && confirm ? (
            <div className="mt-4 border-2 border-amber-500 p-4" role="dialog" aria-label={t("handOver")}>
              <p className="font-semibold">{t("handOverConfirm", { name: confirm.name })}</p>
              <div className="mt-3 flex gap-3">
                <Button type="button" busy={act.isPending} onClick={() => act.mutate(() => teams.handOver(id, confirm.handOver))}>
                  {t("handOver")}
                </Button>
                <button type="button" className="min-h-12 px-3 font-semibold underline" onClick={() => setConfirm(null)}>
                  {t("cancel")}
                </button>
              </div>
            </div>
          ) : null}

          {team.can.invite && team.invites.length ? (
            <>
              <h2 className="mt-8 text-xl font-extrabold">{t("pendingInvites")}</h2>
              <ul className="mt-3 glass-card divide-y divide-[var(--glass-edge)] px-4" data-testid="team-pending">
                {team.invites.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono font-bold">{i.phoneMasked}</span>
                      <span className="block text-sm text-muted">{t("expires", { date: date(i.expiresAt) })}</span>
                    </span>
                    <button type="button" className="min-h-11 border-2 border-line px-3 text-sm font-bold hover:border-brand" onClick={() => inviteAct.mutate({ inviteId: i.id, kind: "resend" })}>
                      {t("resend")}
                    </button>
                    <button type="button" className="min-h-11 border-2 border-line px-3 text-sm font-bold hover:border-danger" onClick={() => inviteAct.mutate({ inviteId: i.id, kind: "cancel" })}>
                      {t("cancelInvite")}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6">
          {team.can.invite ? (
            <form
              className="flex flex-col gap-3 glass-card p-4"
              data-testid="invite-form"
              onSubmit={(e) => {
                e.preventDefault();
                invite.mutate();
              }}
            >
              <h2 className="text-lg font-extrabold">{t("invitePlayer")}</h2>
              <Field id="invite-phone" label={t("phone")} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="01XXXXXXXXX" hint={t("inviteHint")} error={err(invite.error) ?? undefined} />
              <Button type="submit" busy={invite.isPending}>
                {t("invite")}
              </Button>
              {share ? (
                <div className="flex flex-col gap-2 border-t-2 border-line pt-3" data-testid="share-link">
                  <p className="text-sm font-semibold">{t("shareThis")}</p>
                  <input readOnly value={share} aria-label={t("shareLink")} className="min-h-11 border-2 border-line bg-surface-2 px-2 font-mono text-sm" data-testid="share-url" onFocus={(e) => e.currentTarget.select()} />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="min-h-11 border-2 border-line px-3 text-sm font-bold hover:border-brand"
                      onClick={() => navigator.clipboard?.writeText(share).then(() => setCopied(true), () => setCopied(false))}
                    >
                      {copied ? t("copied") : t("copy")}
                    </button>
                    <a href={whatsappUrl(shareText)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center bg-[#1f7a4d] px-3 text-sm font-bold text-white">
                      {t("whatsapp")}
                    </a>
                  </div>
                </div>
              ) : null}
            </form>
          ) : null}

          {team.can.manage ? (
            <div className="flex flex-col gap-3 border-2 border-line p-4">
              <h2 className="text-lg font-extrabold">{t("captainTools")}</h2>
              {edit ? (
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    act.mutate(() => teams.update(id, { name: edit.name, shortCode: edit.shortCode || null }));
                  }}
                >
                  <Field id="edit-name" label={t("teamName")} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required minLength={2} maxLength={40} />
                  <Field id="edit-short" label={t("shortCode")} value={edit.shortCode} onChange={(e) => setEdit({ ...edit, shortCode: e.target.value.toUpperCase() })} maxLength={4} />
                  <div className="flex gap-3">
                    <Button type="submit" busy={act.isPending}>
                      {t("save")}
                    </Button>
                    <button type="button" className="min-h-12 px-3 font-semibold underline" onClick={() => setEdit(null)}>
                      {t("cancel")}
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" className="min-h-11 border-2 border-line px-3 text-left font-bold hover:border-brand" onClick={() => setEdit({ name: team.name, shortCode: team.shortCode ?? "" })}>
                  {t("editTeam")}
                </button>
              )}
              <label className="flex min-h-11 cursor-pointer items-center border-2 border-line px-3 font-bold hover:border-brand">
                {t("uploadLogo")}
                <input
                  type="file"
                  accept={LOGO_TYPES.join(",")}
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    if (!LOGO_TYPES.includes(file.type)) return setLogoError(t("logoType"));
                    if (file.size > MAX_LOGO) return setLogoError(t("logoSize"));
                    setLogoError(null);
                    act.mutate(() => teams.uploadLogo(id, file));
                  }}
                />
              </label>
              {logoError ? <Notice tone="error">{logoError}</Notice> : null}
              {confirm === "archive" ? (
                <div className="border-2 border-danger p-3">
                  <p className="font-semibold">{t("archiveConfirm")}</p>
                  <div className="mt-3 flex gap-3">
                    <button type="button" className="min-h-12 bg-danger px-4 font-bold text-white" onClick={() => act.mutate(() => teams.archive(id))}>
                      {t("archive")}
                    </button>
                    <button type="button" className="min-h-12 px-3 font-semibold underline" onClick={() => setConfirm(null)}>
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="min-h-11 border-2 border-line px-3 text-left font-bold text-danger hover:border-danger" onClick={() => setConfirm("archive")}>
                  {t("archive")}
                </button>
              )}
            </div>
          ) : null}

          {team.can.leave ? (
            confirm === "leave" ? (
              <div className="border-2 border-danger p-3">
                <p className="font-semibold">{isCaptain ? t("captainLeave") : t("leaveConfirm")}</p>
                <div className="mt-3 flex gap-3">
                  {!isCaptain || team.members.length === 1 ? (
                    <button type="button" className="min-h-12 bg-danger px-4 font-bold text-white" onClick={() => leave.mutate()}>
                      {t("leave")}
                    </button>
                  ) : null}
                  <button type="button" className="min-h-12 px-3 font-semibold underline" onClick={() => setConfirm(null)}>
                    {t("cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="min-h-11 border-2 border-line px-3 text-left font-bold hover:border-danger" onClick={() => setConfirm("leave")}>
                {t("leave")}
              </button>
            )
          ) : null}
        </aside>
      </div>
    </section>
  );
}
