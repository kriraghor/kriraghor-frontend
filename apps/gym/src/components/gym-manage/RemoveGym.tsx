"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button, Card, Dialog, Field, Notice, Textarea, useToast } from "@kriraghor/ui/kit";
import { useRouter } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { gymDesk } from "@/lib/manage";
import { useGymError, type GymCtx } from "./common";

/**
 * The owner removes this gym (M20-FR-15, 7 Nov 2026), at the foot of /manage/[gymId]/settings. Nothing is
 * deleted: the gym leaves search and the desk, its members, fees and receipts are kept, and a plan slot
 * frees up. The owner types the gym's name to confirm. The backend refuses while members hold paid online
 * packages (GYM_HAS_ACTIVE_PASSES, with the count) or while staff have the gym suspended: a suspended gym
 * says so up front and points to support (tester feedback, 19 Nov 2026), and "My gyms" links here.
 */
export function RemoveGym({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gm.remove");
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!ctx.owner) return null;
  const gymName = ctx.gym.name;
  const suspended = ctx.gym.listingStatus === "suspended";
  const matches = name.trim().toLocaleLowerCase() === gymName.trim().toLocaleLowerCase();
  const close = (o: boolean) => {
    if (busy) return;
    if (!o) {
      setName("");
      setReason("");
      setProblem(null);
    }
    setOpen(o);
  };
  const confirm = async () => {
    if (!matches) return setProblem(t("mismatch"));
    setBusy(true);
    setProblem(null);
    try {
      await gymDesk.remove(ctx.gymId, { confirmName: name.trim(), ...(reason.trim().length >= 5 ? { reason: reason.trim() } : {}) });
      await qc.invalidateQueries({ queryKey: ["manage-gyms"] });
      toast.show(t("done", { name: gymName }));
      setOpen(false);
      router.replace("/manage");
    } catch (e) {
      const p = problemOf(e) as { code?: string; passes?: number } | null;
      setProblem(p?.code === "GYM_HAS_ACTIVE_PASSES" ? t("activePasses", { n: p.passes ?? 0 }) : err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card id="gm-remove" className="flex scroll-mt-24 flex-col gap-3 border-danger/40" data-testid="gm-remove">
      <h2 className="font-display text-lg font-bold text-danger">{t("title")}</h2>
      <p className="max-w-[65ch] text-sm text-muted">{t("body")}</p>
      {suspended ? <Notice tone="warning">{t("suspended")}</Notice> : null}
      <div>
        <Button type="button" variant="danger" onClick={() => setOpen(true)} disabled={suspended} data-testid="gm-remove-open">
          {t("open")}
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={close}
        title={t("confirmTitle", { name: gymName })}
        description={t("confirmBody")}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => close(false)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button type="button" variant="danger" onClick={confirm} busy={busy} disabled={!matches} data-testid="gm-remove-confirm">
              {t("confirm")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 px-6 pb-2">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>{t("keeps")}</li>
            <li>{t("hides")}</li>
            <li>{t("final")}</li>
          </ul>
          <Field id="gm-remove-name" label={t("typeName", { name: gymName })} value={name} autoComplete="off" onChange={(e) => setName(e.target.value)} data-testid="gm-remove-name" autoFocus />
          <Textarea id="gm-remove-reason" label={t("reason")} optional={t("optional")} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
          {problem ? (
            <p role="alert" className="text-sm text-danger">
              {problem}
            </p>
          ) : null}
        </div>
      </Dialog>
    </Card>
  );
}
