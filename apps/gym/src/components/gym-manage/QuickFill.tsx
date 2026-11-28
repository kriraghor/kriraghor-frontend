"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Lightning } from "@phosphor-icons/react";
import { Button, Card, Notice, Textarea, useConfirm, useToast } from "@kriraghor/ui/kit";
import type { PlanContent, PlanKind } from "@/lib/gym-manage";
import { itemCount } from "@/lib/plans";
import { quickFill } from "@/lib/plan-quickfill";

/**
 * Quick fill (tester feedback, 28 Nov 2026): type the plan as text ("Breakfast: 2 eggs, almonds" or
 * "Day 1: Bench press 3x10, Squat 4x8") and press Fill; the form below is filled and can still be edited.
 * Replacing a form that already has items asks first.
 */
export function QuickFill({ kind, value, onFill }: { kind: PlanKind; value: PlanContent; onFill: (c: PlanContent) => void }) {
  const t = useTranslations("gp.plans");
  const ask = useConfirm();
  const toast = useToast();
  const [text, setText] = useState("");
  const [cut, setCut] = useState(false);
  const fill = async () => {
    if (!text.trim()) return;
    if (itemCount(value) > 0 && !(await ask({ kind: "save", title: t("quickReplaceTitle"), body: t("quickReplaceBody") }))) return;
    const r = quickFill(kind, text, value);
    onFill(r.content);
    setCut(r.cut);
    toast.show(t(kind === "diet" ? "quickFilledDiet" : "quickFilledWorkout", { groups: r.groups, items: r.items }));
  };
  return (
    <Card className="flex flex-col gap-3" data-testid="plan-quickfill">
      <div>
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Lightning size={20} weight="fill" className="text-brand-text" aria-hidden />
          {t("quickTitle")}
        </h2>
        <p className="text-sm text-muted">{t(kind === "diet" ? "quickLeadDiet" : "quickLeadWorkout")}</p>
      </div>
      <Textarea
        id="plan-quickfill-text"
        label={t("quickLabel")}
        value={text}
        maxLength={8000}
        onChange={(e) => setText(e.target.value)}
        placeholder={t(kind === "diet" ? "quickPhDiet" : "quickPhWorkout")}
        className="[&_textarea]:min-h-32"
        data-testid="plan-quickfill-text"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void fill()} disabled={!text.trim()} data-testid="plan-quickfill-go">
          {t("quickGo")}
        </Button>
        <span className="text-xs text-muted">{t("quickHint")}</span>
      </div>
      {cut ? <Notice tone="warning">{t("quickCut")}</Notice> : null}
    </Card>
  );
}
