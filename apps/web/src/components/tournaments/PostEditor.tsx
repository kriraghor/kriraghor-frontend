"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ImageSquare, Trash } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { SignedOutCard } from "@kriraghor/ui/account";
import { DatePicker } from "@kriraghor/ui/date";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { Button, Field, IconButton, Notice, Select, Skeleton, Textarea } from "@kriraghor/ui/kit";
import { dayKey } from "@/lib/tournament-dates";
import { EMPTY_FORM, FORMATS, formOf, formProblems, GENDERS, poishaOf, SKILLS, takaOf, tournamentPosts, type Format, type Gender, type PostForm, type PostPage, type Skill } from "@/lib/tournament-posts";

const blankToNull = (v: string) => (v.trim() ? v : null);

/**
 * /tournaments/new and /tournaments/[slug]/edit (M26-FR-01 to FR-04): every detail of a tournament,
 * in sections. A new post goes live at once, then its photos can be added. Phones and links are
 * refused in the text; people reach the organiser by private message.
 */
export function PostEditor({ slug }: { slug?: string }) {
  const t = useTranslations("tournaments");
  const { status } = useAuth();
  const existing = useQuery({ queryKey: ["tournament-post", slug], queryFn: () => tournamentPosts.page(slug!), enabled: Boolean(slug) });
  if (status === "signed_out") return <SignedOutCard signInHref={`/sign-in?next=${slug ? `/tournaments/${slug}/edit` : "/tournaments/new"}`} />;
  if (slug && existing.isPending) return <Skeleton className="mx-auto mt-10 h-96 max-w-3xl rounded-card" />;
  if (slug && (!existing.data || !existing.data.can.edit)) return <Notice tone="error" className="mx-auto mt-10 max-w-3xl">{t("cannotEdit")}</Notice>;
  return <Form key={existing.data?.id ?? "new"} post={existing.data} />;
}

function Form({ post }: { post?: PostPage }) {
  const t = useTranslations("tournaments");
  const optional = t("optional");
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const [f, setF] = useState<PostForm>(post ? formOf(post) : EMPTY_FORM);
  const [fee, setFee] = useState(post ? takaOf(post.entryFee) : "");
  const [prize, setPrize] = useState(post ? takaOf(post.prizePool) : "");
  const [divisionId, setDivisionId] = useState(post?.division?.id ?? "");
  const [tried, setTried] = useState(false);
  const set = <K extends keyof PostForm>(k: K, v: PostForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const sports = useQuery({ queryKey: ["catalog-sports"], queryFn: tournamentPosts.sports, staleTime: 3600_000 });
  const places = useQuery({ queryKey: ["catalog-locations"], queryFn: tournamentPosts.locations, staleTime: 3600_000 });
  const areas = useQuery({ queryKey: ["catalog-areas", f.districtId], queryFn: () => tournamentPosts.areas(f.districtId), enabled: Boolean(f.districtId), staleTime: 3600_000 });
  const districts = (places.data ?? []).find((d) => d.id === divisionId)?.districts ?? [];
  const today = dayKey();
  const problems = formProblems(f, post ? "0000-00-00" : today);
  const err = (k: keyof PostForm) => (tried && problems.includes(k) ? t(`formError.${k}`) : undefined);
  const save = useMutation({
    mutationFn: () => {
      const body: PostForm = { ...f, entryFee: poishaOf(fee) ?? 0, prizePool: poishaOf(prize) };
      return post ? tournamentPosts.update(post.id, body) : tournamentPosts.create(body);
    },
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["tournament-post", r.slug] });
      await qc.invalidateQueries({ queryKey: ["tournament-feed"] });
      router.push(`/tournaments/${r.slug}`);
    },
  });
  const problem = problemOf(save.error);
  const refused = problem?.code === "CONTACT_NOT_ALLOWED" ? (problem as { field?: string }).field : null;
  const contact = (k: string) => (refused === k ? t("contactRefused") : undefined);

  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-8" data-testid="post-editor">
      <h1 className="text-3xl font-extrabold">{post ? t("editTitle") : t("newTitle")}</h1>
      <p className="mt-1 text-muted">{post ? t("editLead") : t("newLead")}</p>
      <form
        className="mt-6 flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (!problems.length) save.mutate();
        }}
        noValidate
      >
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-xl font-extrabold">{t("section.basics")}</legend>
          <Field id="post-title" label={t("field.title")} value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={120} error={err("title") ?? contact("title")} data-testid="post-title" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select id="post-sport" label={t("field.sport")} value={f.sport} onChange={(e) => set("sport", e.target.value)} error={err("sport")} data-testid="post-sport">
              <option value="">{t("choose")}</option>
              {(sports.data ?? []).map((s) => (
                <option key={s.key} value={s.key}>
                  {name(s)}
                </option>
              ))}
            </Select>
            <Select id="post-format" label={t("field.format")} value={f.format} onChange={(e) => set("format", e.target.value as Format)} data-testid="post-format">
              {FORMATS.map((x) => (
                <option key={x} value={x}>
                  {t(`format.${x}`)}
                </option>
              ))}
            </Select>
          </div>
          <Field id="post-organiser" label={t("field.organiserName")} hint={t("field.organiserHint")} value={f.organiserName} onChange={(e) => set("organiserName", e.target.value)} maxLength={120} error={err("organiserName") ?? contact("organiserName")} data-testid="post-organiser" />
          <Textarea id="post-description" label={t("field.description")} hint={t("field.descriptionHint")} value={f.description} onChange={(e) => set("description", e.target.value)} rows={5} maxLength={5000} error={err("description") ?? contact("description")} data-testid="post-description" />
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-xl font-extrabold">{t("section.when")}</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <DatePicker id="post-start" label={t("field.startDate")} value={f.startDate} onChange={(v) => set("startDate", v)} min={post ? undefined : today} error={err("startDate")} testId="post-start" />
            <DatePicker id="post-end" label={t("field.endDate")} optional={optional} value={f.endDate ?? ""} onChange={(v) => set("endDate", v || null)} min={f.startDate || today} error={err("endDate")} testId="post-end" />
            <DatePicker id="post-deadline" label={t("field.deadline")} value={f.registrationDeadline} onChange={(v) => set("registrationDeadline", v)} max={f.startDate || undefined} error={err("registrationDeadline")} testId="post-deadline" />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-xl font-extrabold">{t("section.where")}</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              id="post-division"
              label={t("field.division")}
              value={divisionId}
              onChange={(e) => {
                setDivisionId(e.target.value);
                setF((x) => ({ ...x, districtId: "", areaId: null }));
              }}
              data-testid="post-division"
            >
              <option value="">{t("choose")}</option>
              {(places.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {name(d)}
                </option>
              ))}
            </Select>
            <Select id="post-district" label={t("field.district")} value={f.districtId} onChange={(e) => setF((x) => ({ ...x, districtId: e.target.value, areaId: null }))} disabled={!divisionId} error={err("districtId")} data-testid="post-district">
              <option value="">{t("choose")}</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {name(d)}
                </option>
              ))}
            </Select>
            <Select id="post-area" label={t("field.area")} optional={optional} value={f.areaId ?? ""} onChange={(e) => set("areaId", e.target.value || null)} disabled={!f.districtId} data-testid="post-area">
              <option value="">{t("choose")}</option>
              {(areas.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {name(a)}
                </option>
              ))}
            </Select>
          </div>
          <Field id="post-venue" label={t("field.venueName")} value={f.venueName} onChange={(e) => set("venueName", e.target.value)} maxLength={120} error={err("venueName") ?? contact("venueName")} data-testid="post-venue" />
          <Field id="post-address" label={t("field.address")} optional={optional} value={f.address ?? ""} onChange={(e) => set("address", blankToNull(e.target.value))} maxLength={240} error={contact("address")} />
          <Field id="post-map" label={t("field.mapLink")} optional={optional} hint={t("field.mapHint")} type="url" value={f.mapLink ?? ""} onChange={(e) => set("mapLink", blankToNull(e.target.value))} maxLength={300} error={problem?.code === "TOURNAMENT_POST_MAP_LINK" ? t("field.mapHint") : undefined} />
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-xl font-extrabold">{t("section.money")}</legend>
          <p className="text-sm text-muted">{t("moneyNote")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="post-fee" label={t("field.fee")} hint={t("field.feeHint")} inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} data-testid="post-fee" />
            <Field id="post-prize" label={t("field.prizePool")} optional={optional} inputMode="numeric" value={prize} onChange={(e) => setPrize(e.target.value)} data-testid="post-prize" />
          </div>
          <Textarea id="post-prize-details" label={t("field.prizeDetails")} optional={optional} value={f.prizeDetails ?? ""} onChange={(e) => set("prizeDetails", blankToNull(e.target.value))} rows={2} maxLength={500} error={contact("prizeDetails")} />
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-xl font-extrabold">{t("section.who")}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select id="post-gender" label={t("field.gender")} value={f.gender} onChange={(e) => set("gender", e.target.value as Gender)}>
              {GENDERS.map((x) => (
                <option key={x} value={x}>
                  {t(`gender.${x}`)}
                </option>
              ))}
            </Select>
            <Select id="post-skill" label={t("field.skillLevel")} optional={optional} value={f.skillLevel ?? ""} onChange={(e) => set("skillLevel", (e.target.value || null) as Skill | null)}>
              <option value="">{t("choose")}</option>
              {SKILLS.map((x) => (
                <option key={x} value={x}>
                  {t(`skill.${x}`)}
                </option>
              ))}
            </Select>
            <Field id="post-age" label={t("field.ageGroup")} optional={optional} hint={t("field.ageHint")} value={f.ageGroup ?? ""} onChange={(e) => set("ageGroup", blankToNull(e.target.value))} maxLength={40} error={contact("ageGroup")} />
            <Field id="post-team-limit" label={t("field.teamLimit")} optional={optional} inputMode="numeric" value={f.teamLimit ?? ""} onChange={(e) => set("teamLimit", Number(e.target.value) || null)} />
            <Field id="post-players" label={t("field.playersPerTeam")} optional={optional} inputMode="numeric" value={f.playersPerTeam ?? ""} onChange={(e) => set("playersPerTeam", Number(e.target.value) || null)} />
          </div>
          <Textarea id="post-rules" label={t("field.rules")} optional={optional} value={f.rules ?? ""} onChange={(e) => set("rules", blankToNull(e.target.value))} rows={4} maxLength={5000} error={contact("rules")} />
        </fieldset>

        {post ? <Photos post={post} /> : <p className="text-sm text-muted">{t("photosAfter")}</p>}

        {problem && !refused ? (
          <div data-testid="post-error"><Notice tone="error">
            {problem.code === "PHONE_REQUIRED" ? (
              <>
                {t("phoneRequired")}{" "}
                <Link href="/account/settings#phone" className="font-semibold">
                  {t("addPhone")}
                </Link>
              </>
            ) : (
              (problem.title ?? t("failed"))
            )}
          </Notice></div>
        ) : null}
        {tried && problems.length ? <div data-testid="post-incomplete"><Notice tone="error">{t("incomplete")}</Notice></div> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg" busy={save.isPending} data-testid="post-save">
            {post ? t("saveChanges") : t("publish")}
          </Button>
        </div>
      </form>
    </section>
  );
}

/** Poster and photos of a saved post: the first is the cover. */
function Photos({ post }: { post: PostPage }) {
  const t = useTranslations("tournaments");
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["tournament-post", post.slug] });
  const add = useMutation({ mutationFn: (file: File) => tournamentPosts.addPhoto(post.id, file), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => tournamentPosts.removePhoto(post.id, id), onSuccess: refresh });
  const problem = problemOf(add.error ?? remove.error);
  return (
    <fieldset className="flex flex-col gap-3" data-testid="post-photo-editor">
      <legend className="mb-3 text-xl font-extrabold">{t("section.photos")}</legend>
      <p className="text-sm text-muted">{t("photosLead")}</p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {post.photos.map((ph) => (
          <li key={ph.id} className="relative aspect-[4/3] overflow-hidden rounded-card bg-surface-2">
            <Image src={ph.url} alt="" fill sizes="240px" className="object-cover" unoptimized />
            <IconButton label={t("removePhoto")} className="absolute right-1.5 top-1.5 bg-surface" onClick={() => remove.mutate(ph.id)}>
              <Trash size={18} aria-hidden />
            </IconButton>
          </li>
        ))}
      </ul>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={t("addPhoto")}
        data-testid="post-photo-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) add.mutate(file);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="secondary" className="self-start" icon={<ImageSquare size={18} aria-hidden />} busy={add.isPending} onClick={() => input.current?.click()}>
        {t("addPhoto")}
      </Button>
      {problem ? <Notice tone="error">{problem.title ?? t("failed")}</Notice> : null}
    </fieldset>
  );
}
