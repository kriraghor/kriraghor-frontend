"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Books, CaretDown, CaretUp, MagnifyingGlass, X } from "@phosphor-icons/react";
import { Badge, Button, Dialog, Field, Select, SkeletonList } from "@kriraghor/ui/kit";
import { gymOps2, type Exercise as LibraryExercise } from "@/lib/gym-ops";

/** The library is reference data and changes only with a seed (M27-FR-70), so one fetch a session is enough. */
export function useExerciseLibrary(enabled = true) {
  return useQuery({ queryKey: ["catalog-exercises"], queryFn: () => gymOps2.exercises(), staleTime: Infinity, enabled });
}

const MUSCLES = ["chest", "back", "shoulders", "arms", "legs", "glutes", "core", "full_body", "cardio"] as const;

/**
 * "From the library" in the plan editor (M27-FR-71): search the exercise library and pick one. The parent fills
 * the bilingual name, the library key (so the member sees the steps) and the video link when it is empty.
 */
export function ExercisePick({ linkedKey, onPick, onUnlink }: { linkedKey?: string | null; onPick: (x: LibraryExercise) => void; onUnlink: () => void }) {
  const t = useTranslations("go.lib");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const lib = useExerciseLibrary(open || Boolean(linkedKey));
  const linked = linkedKey ? lib.data?.items.find((x) => x.key === linkedKey) : undefined;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {linkedKey ? (
        <Badge tone="brand" className="gap-1">
          <Books size={14} aria-hidden />
          {linked ? (locale === "bn" ? linked.nameBn : linked.nameEn) : t("linked")}
          <button type="button" onClick={onUnlink} aria-label={t("unlink")} className="-mr-1 rounded-full p-0.5 hover:bg-black/10">
            <X size={12} aria-hidden />
          </button>
        </Badge>
      ) : null}
      <button type="button" onClick={() => setOpen(true)} className="flex w-fit items-center gap-1 text-sm font-semibold text-brand-text" data-testid="exercise-pick">
        <Books size={16} aria-hidden />
        {linkedKey ? t("change") : t("pick")}
      </button>
      {open ? (
        <PickDialog
          onClose={() => setOpen(false)}
          onPick={(x) => {
            onPick(x);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function PickDialog({ onClose, onPick }: { onClose: () => void; onPick: (x: LibraryExercise) => void }) {
  const t = useTranslations("go.lib");
  const locale = useLocale();
  const lib = useExerciseLibrary();
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const items = useMemo(() => {
    const words = q.trim().toLowerCase();
    return (lib.data?.items ?? []).filter((x) => (!muscle || x.muscle === muscle) && (!words || x.nameEn.toLowerCase().includes(words) || x.nameBn.includes(words)));
  }, [lib.data, q, muscle]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t("title")} description={t("lead")}>
      <div className="flex flex-col gap-3 px-6 pb-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Field id="lib-q" label={t("search")} value={q} onChange={(e) => setQ(e.target.value)} leading={<MagnifyingGlass size={16} aria-hidden />} autoFocus />
          <Select id="lib-muscle" label={t("muscle")} value={muscle} onChange={(e) => setMuscle(e.target.value)}>
            <option value="">{t("allMuscles")}</option>
            {MUSCLES.map((m) => (
              <option key={m} value={m}>
                {t(`muscles.${m}`)}
              </option>
            ))}
          </Select>
        </div>
        {lib.isPending ? (
          <SkeletonList rows={4} />
        ) : !items.length ? (
          <p className="py-6 text-center text-sm text-muted">{t("none")}</p>
        ) : (
          <ul className="flex max-h-[50dvh] flex-col divide-y divide-line overflow-y-auto" data-testid="exercise-library">
            {items.map((x) => (
              <li key={x.key}>
                <button type="button" onClick={() => onPick(x)} className="flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block font-semibold">{locale === "bn" ? x.nameBn : x.nameEn}</span>
                    <span className="block text-xs text-muted">{locale === "bn" ? x.nameEn : x.nameBn}</span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <Badge tone="neutral">{t(`muscles.${x.muscle}`)}</Badge>
                    <Badge tone="neutral">{t(`equipment.${x.equipment}`)}</Badge>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button variant="ghost" className="self-end" onClick={onClose}>
          {t("close")}
        </Button>
      </div>
    </Dialog>
  );
}

/** The library steps under an exercise of my plan (M27-FR-71), folded away until asked for. */
export function ExerciseSteps({ exerciseKey }: { exerciseKey: string }) {
  const t = useTranslations("go.lib");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const lib = useExerciseLibrary();
  const x = lib.data?.items.find((e) => e.key === exerciseKey);
  if (!x) return null;
  const steps = locale === "bn" && x.stepsBn.length ? x.stepsBn : x.stepsEn;
  if (!steps.length) return null;
  return (
    <div className="mt-1">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 text-xs font-semibold text-brand-text" aria-expanded={open}>
        {open ? <CaretUp size={12} aria-hidden /> : <CaretDown size={12} aria-hidden />}
        {open ? t("hideSteps") : t("showSteps")}
      </button>
      {open ? (
        <ol className="mt-1 list-decimal pl-5 text-sm text-muted" data-testid="exercise-steps">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
