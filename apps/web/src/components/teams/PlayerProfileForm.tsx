"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { problemOf } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { setUsername, teams, teamSports, togglePosition, type PlayerProfile } from "@/lib/teams";
import { MePanel } from "../MePanel";
import { Button, Field, Notice } from "../ui";

type Pick = { sportKey: string; positions: string[] };

/**
 * /me/player (M16-FR-05): sports and positions (from each sport's list), a short bio and who can see
 * the page. The public page lives at /players/{username}; it never shows gender, DOB or phone.
 */
export function PlayerProfileForm() {
  const t = useTranslations("teams");
  const { status } = useAuth();
  const q = useQuery({ queryKey: ["my-player-profile"], queryFn: teams.profile, enabled: status === "signed_in" });

  if (status === "signed_out") return <MePanel />;
  if (q.isPending) return <div className="mx-auto mt-10 h-96 max-w-[760px] animate-pulse bg-surface-2" />;
  if (q.isError || !q.data) return <p className="mx-auto max-w-[760px] px-5 py-10">{t("failed")}</p>;
  return <Editor initial={q.data} />;
}

function Editor({ initial }: { initial: PlayerProfile }) {
  const t = useTranslations("teams");
  const locale = useLocale();
  const qc = useQueryClient();
  const sports = useQuery({ queryKey: ["catalog-sports"], queryFn: teams.sports, staleTime: 3600_000 });
  const [picks, setPicks] = useState<Pick[]>(() => initial.sports.map((x) => ({ sportKey: x.sportKey, positions: x.positions })));
  const [bio, setBio] = useState(initial.bio ?? "");
  const [visibility, setVisibility] = useState<"public" | "members">(initial.visibility);
  const [handle, setHandle] = useState("");
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: () => teams.saveProfile({ sports: picks, bio: bio.trim() || null, visibility }),
    onSuccess: (r) => {
      qc.setQueryData(["my-player-profile"], r);
      setSaved(true);
    },
  });
  const name = useMutation({ mutationFn: () => setUsername(handle.trim()), onSuccess: () => qc.invalidateQueries({ queryKey: ["my-player-profile"] }) });

  const all = teamSports(sports.data ?? []);
  const label = (x: { en: string; bn: string }) => (locale === "bn" ? x.bn : x.en);
  const err = (e: unknown) => {
    const p = problemOf(e);
    return p ? (t.has(`errors.${p.code}`) ? t(`errors.${p.code}`) : (p.title ?? t("failed"))) : null;
  };
  // The parent passes the refetched profile after a username is set.
  const username = initial.username;

  return (
    <section className="mx-auto max-w-[760px] px-5 py-10">
      <Link href="/me/teams" className="text-sm font-semibold text-brand underline">
        ← {t("myTeams")}
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold">{t("playerProfile")}</h1>
      <p className="mt-1 text-muted">{t("profilePrivacy")}</p>

      <div className="mt-6 border-2 border-line p-4">
        {username ? (
          <p>
            {t("publicPage")}{" "}
            <Link href={`/players/${username}`} className="font-mono font-bold text-brand underline" data-testid="public-page-link">
              /players/{username}
            </Link>
          </p>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              name.mutate();
            }}
          >
            <Field id="player-handle" label={t("username")} value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} minLength={3} maxLength={30} required hint={t("usernameHint")} error={err(name.error) ?? undefined} />
            <Button type="submit" busy={name.isPending}>
              {t("setUsername")}
            </Button>
          </form>
        )}
      </div>

      <form
        className="mt-6 flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          save.mutate();
        }}
      >
        <fieldset className="border-2 border-line p-4">
          <legend className="px-1 font-extrabold">{t("sportsAndPositions")}</legend>
          <ul className="flex flex-col gap-4">
            {all.map((s) => {
              const pick = picks.find((p) => p.sportKey === s.key);
              return (
                <li key={s.key}>
                  <label className="flex min-h-11 items-center gap-3 font-bold">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={!!pick}
                      onChange={() => setPicks(pick ? picks.filter((p) => p.sportKey !== s.key) : [...picks, { sportKey: s.key, positions: [] }])}
                    />
                    {locale === "bn" ? s.nameBn : s.nameEn}
                  </label>
                  {pick ? (
                    <div className="ml-8 flex flex-wrap gap-2">
                      {(s.positions ?? []).map((pos) => {
                        const on = pick.positions.includes(pos.key);
                        return (
                          <button key={pos.key} type="button" aria-pressed={on} onClick={() => setPicks(togglePosition(picks, s.key, pos.key))} className={`min-h-11 border-2 px-3 text-sm font-bold ${on ? "border-brand bg-brand text-white" : "border-line hover:border-brand"}`}>
                            {label(pos)}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor="player-bio" className="text-sm font-semibold text-muted">
            {t("bio")}
          </label>
          <textarea id="player-bio" rows={3} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} className="border-2 border-line bg-surface p-3" />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="font-extrabold">{t("whoSees")}</legend>
          {(["public", "members"] as const).map((v) => (
            <label key={v} className="flex min-h-11 items-center gap-3">
              <input type="radio" name="visibility" className="size-5" checked={visibility === v} onChange={() => setVisibility(v)} />
              {t(`visibility.${v}`)}
            </label>
          ))}
        </fieldset>

        {err(save.error) ? <Notice tone="error">{err(save.error)}</Notice> : null}
        {saved ? <Notice>{t("saved")}</Notice> : null}
        <div>
          <Button type="submit" busy={save.isPending}>
            {t("save")}
          </Button>
        </div>
      </form>
    </section>
  );
}
