"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api, problemOf } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { checkTone, fixHref, teams, TONE, type Gender } from "@/lib/teams";
import { MePanel } from "../MePanel";
import { Button, Notice } from "../ui";
import { AddPhone } from "./AddPhone";

/**
 * /me/eligibility (M16-FR-08): am I ready to play? A verified phone, a verified NID (it carries the
 * date of birth age rules use), and gender for men's and women's events. Gender is self-declared once
 * and private: captains, organisers and the public page never see it; staff can correct it.
 */
export function MyEligibility() {
  const t = useTranslations("teams");
  const { status } = useAuth();
  const qc = useQueryClient();
  const on = status === "signed_in";
  const me = useQuery({ queryKey: ["me"], enabled: on, queryFn: async () => ((await api().GET("/me")).data ?? null) });
  const q = useQuery({ queryKey: ["my-eligibility"], enabled: on, queryFn: teams.eligibility });
  const [gender, setGender] = useState<Gender | null>(null);
  const save = useMutation({
    mutationFn: () => teams.setGender(gender!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["my-eligibility"] });
    },
  });

  if (status === "signed_out") return <MePanel />;
  if (q.isPending || me.isPending) return <div className="mx-auto mt-10 h-96 max-w-[760px] animate-pulse bg-surface-2" />;
  if (q.isError || !q.data) return <p className="mx-auto max-w-[760px] px-5 py-10">{t("failed")}</p>;
  const p = problemOf(save.error);

  return (
    <section className="mx-auto max-w-[760px] px-5 py-10">
      <Link href="/me/teams" className="text-sm font-semibold text-brand underline">
        ← {t("myTeams")}
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold">{t("eligibility")}</h1>
      <p className="mt-1 text-muted">{t("eligibilityIntro")}</p>

      <ul className="mt-6 glass-card divide-y divide-[var(--glass-edge)] px-4" data-testid="readiness">
        {q.data.readiness.map((c) => {
          const href = fixHref(c.fix);
          return (
            <li key={c.key} className="flex flex-wrap items-center gap-3 py-3" data-testid={`ready-${c.key}`}>
              <span className="min-w-0 flex-1 font-bold">{t(`check.${c.key}`)}</span>
              <span className={`border-2 px-2 py-0.5 text-sm font-bold ${TONE[checkTone(c.status)]}`}>{t(`status.${c.status}`)}</span>
              {href ? (
                <Link href={href} className="font-semibold text-brand underline">
                  {t(`fix.${c.fix}`)}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>

      {me.data && !me.data.phoneVerified ? (
        <div className="mt-8">
          <AddPhone />
        </div>
      ) : null}

      <div id="gender" className="mt-8 border-2 border-line p-4">
        <h2 className="text-lg font-extrabold">{t("gender")}</h2>
        <p className="text-sm text-muted">{t("genderPrivacy")}</p>
        {me.data?.gender ? (
          <p className="mt-3" data-testid="gender-set">
            {t("genderRecorded", { gender: t(`genders.${me.data.gender}`) })}
          </p>
        ) : (
          <form
            className="mt-3 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (gender) save.mutate();
            }}
          >
            <fieldset className="flex flex-wrap gap-x-6">
              <legend className="sr-only">{t("gender")}</legend>
              {(["male", "female", "third"] as const).map((g) => (
                <label key={g} className="flex min-h-11 items-center gap-2">
                  <input type="radio" name="gender" className="size-5" checked={gender === g} onChange={() => setGender(g)} />
                  {t(`genders.${g}`)}
                </label>
              ))}
            </fieldset>
            <p className="text-sm">{t("genderOnce")}</p>
            {p ? <Notice tone="error">{t.has(`errors.${p.code}`) ? t(`errors.${p.code}`) : (p.title ?? t("failed"))}</Notice> : null}
            <div>
              <Button type="submit" busy={save.isPending} disabled={!gender}>
                {t("saveGender")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
