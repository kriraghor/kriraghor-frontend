"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { problemOf } from "@kriraghor/api-client";
import { gym } from "@/lib/gym";
import { formatTaka } from "@/lib/payments";
import { Button, Field, Notice } from "../ui";
import { SubscriptionCard } from "./MySubscriptions";

type Where = "gym" | "home" | "online";

/**
 * /pro/plans (M20 §6): monthly plans for my fitness trainer profiles, and my subscribers. A new price
 * applies to new subscriptions only; retiring a plan lets the running months finish.
 */
export function ProPlans() {
  const t = useTranslations("gym");
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pro-plans"], queryFn: () => gym.myPlans() });
  const subs = useQuery({ queryKey: ["pro-subscribers"], queryFn: () => gym.subscribers() });
  const retire = useMutation({ mutationFn: (id: string) => gym.retirePlan(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["pro-plans"] }) });
  if (q.isPending) return <div className="h-40 animate-pulse bg-surface-2" />;
  if (q.isError) return <Notice tone="error">{t("error")}</Notice>;
  const { profiles, items } = q.data;
  const live = profiles.filter((p) => ["live", "paused"].includes(p.status));

  return (
    <div className="flex flex-col gap-8" data-testid="pro-plans">
      {!profiles.length ? (
        <p className="border-2 border-dashed border-line p-8 text-center font-semibold">{t("desk.trainerOnly")}</p>
      ) : (
        <>
          <section>
            <h2 className="text-2xl font-extrabold">{t("desk.plans")}</h2>
            {!items.length ? <p className="mt-3 text-muted">{t("desk.noPlans")}</p> : null}
            <ul className="mt-3 flex flex-col gap-3">
              {items.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 border-2 border-line p-4" data-testid="pro-plan">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{p.title}</span>
                    <span className="block text-sm text-muted">
                      {t("perMonth", { price: formatTaka(p.price, locale) })} · {p.sessionsPerMonth ? t("sessions", { n: p.sessionsPerMonth }) : t("sessionsAgreed")} · {t(`where.${p.where}`)}
                    </span>
                  </span>
                  <span className="border-2 border-line px-2 py-0.5 text-sm font-bold">{t(`planStatus.${p.status}`)}</span>
                  {p.status === "active" ? (
                    <button type="button" onClick={() => retire.mutate(p.id)} disabled={retire.isPending} className="min-h-11 border-2 border-line px-4 font-bold disabled:opacity-50">
                      {t("desk.retire")}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
          {live.length ? <NewPlan profiles={live} /> : <p className="text-muted">{t("desk.profileNotLive")}</p>}
        </>
      )}
      <section>
        <h2 className="text-2xl font-extrabold">{t("desk.subscribers")}</h2>
        {subs.isPending ? (
          <div className="mt-3 h-24 animate-pulse bg-surface-2" />
        ) : !subs.data?.items.length ? (
          <p className="mt-3 text-muted">{t("desk.noSubscribers")}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {subs.data.items.map((s) => (
              <SubscriptionCard key={s.id} s={s} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function NewPlan({ profiles }: { profiles: { id: string; headline: string }[] }) {
  const t = useTranslations("gym");
  const locale = useLocale();
  const qc = useQueryClient();
  const [profileId, setProfileId] = useState(profiles[0].id);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sessions, setSessions] = useState("");
  const [taka, setTaka] = useState("");
  const [where, setWhere] = useState<Where>("gym");
  const [gymId, setGymId] = useState("");
  const [areaId, setAreaId] = useState("");
  const gyms = useQuery({ queryKey: ["gyms", "price", undefined], queryFn: () => gym.list({ sort: "price" }), enabled: where === "gym" });
  const areas = useQuery({ queryKey: ["gym-areas"], queryFn: () => gym.areas(), staleTime: 300_000, enabled: where === "home" });
  const create = useMutation({
    mutationFn: () =>
      gym.createPlan({
        profileId,
        title: title.trim(),
        description: description.trim() || null,
        sessionsPerMonth: sessions ? Number(sessions) : null,
        price: Math.round(Number(taka) * 100),
        whereKind: where,
        gymId: where === "gym" ? gymId || null : null,
        areaId: where === "home" ? areaId || null : null,
      }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setSessions("");
      setTaka("");
      qc.invalidateQueries({ queryKey: ["pro-plans"] });
    },
  });
  const problem = create.error ? problemOf(create.error) : null;
  const fieldError = (f: string) => (problem as { errors?: { field: string; message: string }[] } | null)?.errors?.find((e) => e.field === f)?.message;
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);

  return (
    <form
      className="flex max-w-xl flex-col gap-4 border-2 border-line p-5"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
      data-testid="pro-new-plan"
    >
      <h2 className="text-xl font-extrabold">{t("desk.newPlan")}</h2>
      {profiles.length > 1 ? (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("desk.profile")}
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)} className="min-h-11 field px-3">
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.headline}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <Field id="plan-title" label={t("desk.planTitle")} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={80} error={fieldError("title")} />
      <Field id="plan-description" label={t("desk.planDescription")} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} error={fieldError("description")} />
      <div className="grid grid-cols-2 gap-3">
        <Field id="plan-price" label={t("desk.planPrice")} inputMode="numeric" value={taka} onChange={(e) => setTaka(e.target.value.replace(/[^0-9]/g, ""))} required hint={t("desk.planPriceHint")} error={fieldError("price")} />
        <Field id="plan-sessions" label={t("desk.planSessions")} inputMode="numeric" value={sessions} onChange={(e) => setSessions(e.target.value.replace(/[^0-9]/g, ""))} hint={t("desk.planSessionsHint")} error={fieldError("sessionsPerMonth")} />
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">{t("desk.planWhere")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["gym", "home", "online"] as const).map((w) => (
            <label key={w} className={`flex min-h-11 cursor-pointer items-center gap-2 border-2 px-3 ${where === w ? "border-brand" : "border-line"}`}>
              <input type="radio" name="where" checked={where === w} onChange={() => setWhere(w)} />
              {t(`where.${w}`)}
            </label>
          ))}
        </div>
      </fieldset>
      {where === "gym" ? (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("desk.planGym")}
          <select value={gymId} onChange={(e) => setGymId(e.target.value)} required className="min-h-11 field px-3">
            <option value="">–</option>
            {(gyms.data?.items ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.area ? `, ${name(g.area)}` : ""}
              </option>
            ))}
          </select>
          {fieldError("gymId") ? <span className="text-danger">{fieldError("gymId")}</span> : null}
        </label>
      ) : null}
      {where === "home" ? (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("desk.planArea")}
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)} required className="min-h-11 field px-3">
            <option value="">–</option>
            {(areas.data?.items ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {name(a)}
              </option>
            ))}
          </select>
          {fieldError("areaId") ? <span className="text-danger">{fieldError("areaId")}</span> : null}
        </label>
      ) : null}
      {problem && !(problem as { errors?: unknown[] }).errors?.length ? <Notice tone="error">{problem.title}</Notice> : null}
      <Button type="submit" busy={create.isPending} data-testid="pro-plan-save">
        {t("desk.savePlan")}
      </Button>
    </form>
  );
}
