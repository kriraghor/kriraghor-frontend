"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Desktop, Key, LockKey, Power, ShieldCheck } from "@phosphor-icons/react";
import { api } from "@kriraghor/api-client";
import { Avatar, Badge, Button, Card, Dialog, DialogClose, Field, Notice, PageTitle, SectionHeading, Skeleton, useToast } from "@kriraghor/ui/kit";
import { useManageGyms } from "@/components/gym-manage/common";
import { desk, minutesUntil, pinProblem, type DeskOverview } from "@/lib/desk";
import { deskProblem, refreshAsNewPerson } from "./useDesk";

const when = (iso: string, locale: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso));
const day = (iso: string, locale: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Dhaka" }).format(new Date(iso));

/**
 * /manage/:gymId/desk-mode (M24 §21): my own desk PIN, switching this device to desk mode, and, for the
 * owner, who has a PIN (clear one) and the devices in desk mode (end them from here, FR-141).
 */
export function DeskModePage({ gymId }: { gymId: string }) {
  const t = useTranslations("gd.page");
  const gyms = useManageGyms();
  const gym = gyms.data?.items.find((g) => g.id === gymId) ?? null;
  const owner = gym?.role === "owner";
  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-8 px-4 py-8 sm:px-6" data-testid="desk-mode-page">
      <PageTitle title={t("title")} description={t("lead")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <MyPin gymId={gymId} />
        <ThisDevice gymId={gymId} featureOn={gym ? gym.features.desk_mode !== false : true} />
      </div>
      {owner ? <OwnerView gymId={gymId} /> : null}
    </div>
  );
}

function MyPin({ gymId }: { gymId: string }) {
  const t = useTranslations("gd.page");
  const locale = useLocale();
  const qc = useQueryClient();
  const toast = useToast();
  const pins = useQuery({ queryKey: ["my-desk-pins"], queryFn: desk.myPins, retry: false });
  const me = useQuery({ queryKey: ["me"], queryFn: async () => (await api().GET("/me")).data ?? null, retry: false, staleTime: 60_000 });
  const mine = pins.data?.items.find((p) => p.gymId === gymId && p.set) ?? null;
  const [editing, setEditing] = useState(false);
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [tried, setTried] = useState(false);
  const phone = (me.data as { phone?: string | null } | null)?.phone ?? null;
  const problem = pinProblem(pin, phone);
  const mismatch = again.length === 4 && again !== pin;
  const save = useMutation({
    mutationFn: () => desk.setPin(gymId, pin),
    onSuccess: () => {
      toast.show(t("saved"), "success");
      setPin("");
      setAgain("");
      setTried(false);
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ["my-desk-pins"] });
      void qc.invalidateQueries({ queryKey: ["desk-overview", gymId] });
    },
  });
  const serverProblem = deskProblem(save.error);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (problem || again !== pin) return;
    save.mutate();
  };
  const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, 4);
  const showForm = editing || (!pins.isPending && !mine);

  return (
    <Card className="flex flex-col gap-4" data-testid="desk-my-pin">
      <SectionHeading as="h2" title={t("myPin")} />
      {pins.isPending ? (
        <Skeleton className="h-16" />
      ) : mine ? (
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-control bg-brand-soft text-brand-text">
            <Key size={22} weight="fill" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t("state.set")}</p>
            <p className="text-sm text-muted">{mine.setAt ? t("pinSet", { date: day(mine.setAt, locale) }) : null}</p>
            {minutesUntil(mine.lockedUntil) > 0 && mine.lockedUntil ? <p className="text-sm font-semibold text-warning">{t("pinLocked", { time: when(mine.lockedUntil, locale) })}</p> : null}
          </div>
          {!editing ? (
            <Button variant="secondary" size="md" onClick={() => setEditing(true)} data-testid="desk-pin-change">
              {t("change")}
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-muted">{t("pinNone")}</p>
      )}
      {showForm ? (
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="desk-pin-new"
              label={t("newPin")}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(digitsOnly(e.target.value))}
              error={tried && problem ? t(`problem.${problem}`) : serverProblem?.code === "GYM_DESK_PIN_WEAK" && serverProblem.reason ? t(`problem.${serverProblem.reason as "format"}`) : undefined}
              data-testid="desk-pin-input"
            />
            <Field
              id="desk-pin-again"
              label={t("confirmPin")}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={again}
              onChange={(e) => setAgain(digitsOnly(e.target.value))}
              error={(tried || mismatch) && again !== pin ? t("mismatch") : undefined}
              data-testid="desk-pin-again"
            />
          </div>
          <p className="text-sm text-muted">{t("never")}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={save.isPending} data-testid="desk-pin-save">
              <LockKey size={18} weight="fill" aria-hidden />
              {t("save")}
            </Button>
            {editing ? (
              <Button type="button" variant="ghost" onClick={() => (setEditing(false), setPin(""), setAgain(""), setTried(false))}>
                {t("cancel")}
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
    </Card>
  );
}

function ThisDevice({ gymId, featureOn }: { gymId: string; featureOn: boolean }) {
  const t = useTranslations("gd.page");
  const qc = useQueryClient();
  const pins = useQuery({ queryKey: ["my-desk-pins"], queryFn: desk.myPins, retry: false });
  const hasPin = Boolean(pins.data?.items.some((p) => p.gymId === gymId && p.set));
  const [open, setOpen] = useState(false);
  const start = useMutation({
    mutationFn: () => desk.open(gymId),
    onSuccess: (state) => {
      setOpen(false);
      // The shell now shows the lock screen: the device waits for a PIN.
      refreshAsNewPerson(qc, state);
    },
  });
  const p = deskProblem(start.error);
  return (
    <Card className="flex flex-col gap-4" data-testid="desk-this-device">
      <SectionHeading as="h2" title={t("device")} />
      <div className="flex gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-control bg-accent-soft text-accent-text">
          <Desktop size={22} weight="fill" aria-hidden />
        </span>
        <p className="text-sm text-muted">{t("deviceLead")}</p>
      </div>
      {!featureOn ? <Notice tone="info">{t("tierLocked")}</Notice> : !hasPin && !pins.isPending ? <Notice tone="warning">{t("needPin")}</Notice> : null}
      {p ? <Notice tone="error">{p.code === "GYM_TIER_REQUIRED" ? t("tierLocked") : p.code === "GYM_DESK_PIN_REQUIRED" ? t("needPin") : p.title}</Notice> : null}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button variant="accent" disabled={!featureOn || !hasPin} className="self-start" data-testid="desk-switch-on">
            <Power size={18} weight="bold" aria-hidden />
            {t("switchOn")}
          </Button>
        }
        title={t("switchOn")}
        description={t("deviceLead")}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">{t("cancel")}</Button>
            </DialogClose>
            <Button variant="accent" onClick={() => start.mutate()} disabled={start.isPending} data-testid="desk-switch-confirm">
              {t("switchOn")}
            </Button>
          </>
        }
      />
    </Card>
  );
}

function OwnerView({ gymId }: { gymId: string }) {
  const t = useTranslations("gd.page");
  const locale = useLocale();
  const qc = useQueryClient();
  const toast = useToast();
  const view = useQuery({ queryKey: ["desk-overview", gymId], queryFn: () => desk.overview(gymId), retry: false, refetchInterval: 30_000 });
  const reset = useMutation({
    mutationFn: (userId: string) => desk.resetPin(gymId, userId),
    onSuccess: () => {
      toast.show(t("resetDone"), "success");
      void qc.invalidateQueries({ queryKey: ["desk-overview", gymId] });
    },
  });
  const end = useMutation({
    mutationFn: () => desk.end(gymId),
    onSuccess: (r) => {
      toast.show(t("endedAll", { count: r.ended }), "success");
      void qc.invalidateQueries({ queryKey: ["desk-overview", gymId] });
    },
  });
  const data: DeskOverview | undefined = view.data;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="flex flex-col gap-4" data-testid="desk-people-pins">
        <SectionHeading as="h2" title={t("people")} />
        {view.isPending ? (
          <Skeleton className="h-32" />
        ) : (
          <ul className="divide-y divide-line">
            {data?.people.map((p) => (
              <li key={p.userId} className="flex items-center gap-3 py-3">
                <Avatar name={p.displayName ?? "?"} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold">
                    {p.displayName}
                    {p.role === "owner" ? <ShieldCheck size={16} aria-hidden className="text-brand-text" /> : null}
                  </p>
                  <p className="text-sm text-muted">{p.lockedUntil ? t("lockedUntil", { time: when(p.lockedUntil, locale) }) : null}</p>
                </div>
                <Badge tone={p.pin === "set" ? "brand" : p.pin === "cleared" ? "warning" : "neutral"}>{t(`state.${p.pin}`)}</Badge>
                {p.role === "staff" && p.pin === "set" ? (
                  <Dialog
                    trigger={
                      <Button variant="ghost" size="md" data-testid={`desk-reset-${p.userId}`}>
                        {t("reset")}
                      </Button>
                    }
                    title={t("resetTitle", { name: p.displayName ?? "" })}
                    description={t("resetBody")}
                    footer={
                      <>
                        <DialogClose asChild>
                          <Button variant="ghost">{t("cancel")}</Button>
                        </DialogClose>
                        <DialogClose asChild>
                          <Button variant="danger" onClick={() => reset.mutate(p.userId)} data-testid="desk-reset-confirm">
                            {t("reset")}
                          </Button>
                        </DialogClose>
                      </>
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="flex flex-col gap-4" data-testid="desk-devices">
        <SectionHeading as="h2" title={t("desks")} />
        {view.isPending ? (
          <Skeleton className="h-24" />
        ) : data?.desks.length ? (
          <>
            <ul className="flex flex-col gap-3">
              {data.desks.map((d) => (
                <li key={d.deskId} className="rounded-control border border-line p-3">
                  <p className="flex items-center gap-2 font-semibold">
                    <Desktop size={18} aria-hidden className="text-muted" />
                    {d.unlockedBy ? t("atDesk", { name: d.unlockedBy.displayName ?? "" }) : t("lockedNow")}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{t("openedBy", { name: d.openedBy.displayName ?? "", time: when(d.openedAt, locale) })}</p>
                </li>
              ))}
            </ul>
            <Dialog
              trigger={
                <Button variant="danger" className="self-start" data-testid="desk-end-all">
                  <Power size={18} weight="bold" aria-hidden />
                  {t("endAll")}
                </Button>
              }
              title={t("endTitle")}
              description={t("endBody")}
              footer={
                <>
                  <DialogClose asChild>
                    <Button variant="ghost">{t("cancel")}</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="danger" onClick={() => end.mutate()} data-testid="desk-end-confirm">
                      {t("endAll")}
                    </Button>
                  </DialogClose>
                </>
              }
            />
          </>
        ) : (
          <p className="text-muted">{t("noDesks")}</p>
        )}
      </Card>
    </div>
  );
}
