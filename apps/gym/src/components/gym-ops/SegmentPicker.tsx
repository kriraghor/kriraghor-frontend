"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Field, Select } from "@kriraghor/ui/kit";
import { gymOps2, type SegmentDraft, type SegmentKind } from "@/lib/gym-ops";
import { usePackages, type GymCtx } from "../gym-manage/common";

/**
 * Who a message goes to (M27-FR-62; shared by Notices and WhatsApp sends since 21 Nov 2026): all active,
 * ending soon or expired within some days, not seen for some days, on a package, or in a class (only
 * where `kinds` has it and the plan has classes).
 */
export function SegmentPicker({ ctx, kinds, value, onChange, idPrefix, testId }: { ctx: GymCtx; kinds: readonly SegmentKind[]; value: SegmentDraft; onChange: (d: SegmentDraft) => void; idPrefix: string; testId?: string }) {
  const t = useTranslations("go");
  const packages = usePackages(ctx.gymId, value.kind === "package");
  const classes = useQuery({ queryKey: ["go-classes", ctx.gymId], queryFn: () => gymOps2.classes(ctx.gymId), enabled: value.kind === "class" && Boolean(ctx.gym.features.classes) });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Select id={`${idPrefix}-kind`} label={t("notices.to")} value={value.kind} onChange={(e) => onChange({ ...value, kind: e.target.value as SegmentKind })} data-testid={testId}>
        {kinds.map((k) => (
          <option key={k} value={k} disabled={k === "class" && !ctx.gym.features.classes}>
            {t(`notices.seg.${k}`)}
          </option>
        ))}
      </Select>
      {["expiring", "expired", "not_seen"].includes(value.kind) ? (
        <Field id={`${idPrefix}-days`} label={t("notices.days")} inputMode="numeric" value={value.days} onChange={(e) => onChange({ ...value, days: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
      ) : value.kind === "package" ? (
        <Select id={`${idPrefix}-pkg`} label={t("notices.package")} value={value.packageId} onChange={(e) => onChange({ ...value, packageId: e.target.value })}>
          <option value="">–</option>
          {packages.all.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </Select>
      ) : value.kind === "class" ? (
        <Select id={`${idPrefix}-class`} label={t("notices.class")} value={value.classId} onChange={(e) => onChange({ ...value, classId: e.target.value })}>
          <option value="">–</option>
          {(classes.data?.items ?? []).map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </Select>
      ) : null}
    </div>
  );
}
