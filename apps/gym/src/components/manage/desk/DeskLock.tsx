"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft, LockKey, Power, ShieldCheck } from "@phosphor-icons/react";
import { useAuth } from "@kriraghor/ui/auth";
import { useRouter } from "@kriraghor/ui/i18n/navigation";
import { Avatar, Button, Notice } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { desk, minutesUntil, type DeskPerson, type OpenDesk } from "@/lib/desk";
import { PinPad } from "./PinPad";
import { deskProblem, refreshAsNewPerson } from "./useDesk";

type Step = { mode: "unlock" | "close"; person: DeskPerson | null };

/**
 * The locked desk (M24 §21): the whole page until someone picks their name and types their own PIN. The
 * gym's work then opens as them. "End desk mode" asks for any valid PIN of the gym and signs the device out.
 * Wrong tries are counted by the server; this screen only says what it answered.
 */
export function DeskLock({ state }: { state: OpenDesk }) {
  const t = useTranslations("gd.lock");
  const qc = useQueryClient();
  const router = useRouter();
  const { signOut } = useAuth();
  const [step, setStep] = useState<Step>({ mode: "unlock", person: null });
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const deviceWait = minutesUntil(state.deviceLockedUntil);

  const pick = (person: DeskPerson) => {
    setMessage(null);
    setStep((s) => ({ ...s, person }));
  };
  const back = () => {
    setMessage(null);
    setStep((s) => ({ ...s, person: null }));
  };

  const explain = (e: unknown, name: string) => {
    const p = deskProblem(e);
    if (p?.code === "GYM_DESK_PIN_WRONG") return t("wrong", { left: p.left ?? 0 });
    if (p?.code === "GYM_DESK_PIN_LOCKED") return p.scope === "device" ? t("deviceLocked", { minutes: Math.max(1, minutesUntil(p.until)) }) : t("personLocked", { name, minutes: Math.max(1, minutesUntil(p.until)) });
    if (p?.code === "GYM_DESK_PIN_REQUIRED") return t("noPin", { name });
    return t("failed");
  };

  const submit = async (pin: string) => {
    const person = step.person;
    if (!person) return;
    setBusy(true);
    setMessage(null);
    try {
      if (step.mode === "unlock") {
        refreshAsNewPerson(qc, await desk.unlock(person.userId, pin));
      } else {
        await desk.close(person.userId, pin);
        setEnded(true);
        // The server has signed this device out; clear it here too and go to sign-in.
        await signOut().catch(() => undefined);
        qc.clear();
        router.replace("/sign-in");
      }
    } catch (e) {
      setMessage(explain(e, person.displayName ?? ""));
      setShake((n) => n + 1);
      void qc.invalidateQueries({ queryKey: ["desk-mode"] });
    } finally {
      setBusy(false);
    }
  };

  const people = state.people;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-bg" data-testid="desk-lock">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-5 py-10 sm:py-14">
        <span className="grid size-16 place-items-center rounded-card bg-brand-soft text-brand-text">
          {step.mode === "close" ? <Power size={32} weight="bold" aria-hidden /> : <LockKey size={32} weight="fill" aria-hidden />}
        </span>
        <p className="mt-4 text-sm font-semibold text-muted">{state.gym.name}</p>
        <h1 className="mt-1 text-center text-3xl sm:text-4xl">{step.mode === "close" ? t("end") : t("title")}</h1>
        <p className="mt-2 max-w-[42ch] text-center text-muted">{step.mode === "close" ? t("endLead") : t("lead")}</p>

        <div className="mt-8 w-full">
          {ended ? (
            <Notice tone="info">{t("ended")}</Notice>
          ) : deviceWait > 0 ? (
            <Notice tone="warning">{t("deviceLocked", { minutes: deviceWait })}</Notice>
          ) : step.person ? (
            <div className="flex flex-col items-center gap-4" data-testid="desk-pin">
              <button type="button" onClick={back} className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-control px-2 text-sm font-semibold text-brand-text hover:bg-surface-2" data-testid="desk-back">
                <ArrowLeft size={16} weight="bold" aria-hidden />
                {t("back")}
              </button>
              <Avatar name={step.person.displayName ?? "?"} size={56} />
              <PinPad label={step.mode === "close" ? t("endFor", { name: step.person.displayName ?? "" }) : t("pinFor", { name: step.person.displayName ?? "" })} onPin={(pin) => void submit(pin)} busy={busy} shake={shake} disabled={minutesUntil(step.person.lockedUntil) > 0} />
              {message ? (
                <p role="alert" className="max-w-[40ch] text-center text-sm font-semibold text-danger" data-testid="desk-error">
                  {message}
                </p>
              ) : minutesUntil(step.person.lockedUntil) > 0 ? (
                <p role="status" className="max-w-[40ch] text-center text-sm font-semibold text-warning">
                  {t("personLocked", { name: step.person.displayName ?? "", minutes: minutesUntil(step.person.lockedUntil) })}
                </p>
              ) : null}
            </div>
          ) : people.length ? (
            <div>
              <p className="mb-3 text-center font-display text-lg font-bold">{t("who")}</p>
              <ul className="grid gap-3 sm:grid-cols-2" data-testid="desk-people">
                {people.map((p) => (
                  <li key={p.userId}>
                    <button
                      type="button"
                      onClick={() => pick(p)}
                      className={cn("flex min-h-16 w-full items-center gap-3 rounded-card border border-line bg-surface px-4 text-left transition-[transform,border-color] duration-150 hover:border-brand active:scale-[0.99]", minutesUntil(p.lockedUntil) > 0 && "opacity-60")}
                      data-testid={`desk-person-${p.userId}`}
                    >
                      <Avatar name={p.displayName ?? "?"} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{p.displayName}</span>
                        <span className="block text-sm text-muted">{p.role === "owner" ? t("owner") : t("staff")}</span>
                      </span>
                      {p.role === "owner" ? <ShieldCheck size={20} aria-hidden className="shrink-0 text-brand-text" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Notice tone="warning">{t("nobody")}</Notice>
          )}
        </div>

        {!ended && !step.person ? (
          <div className="mt-auto pt-10">
            {step.mode === "unlock" ? (
              <Button variant="ghost" onClick={() => setStep({ mode: "close", person: null })} data-testid="desk-end">
                <Power size={18} aria-hidden />
                {t("end")}
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setStep({ mode: "unlock", person: null })}>
                <ArrowLeft size={18} aria-hidden />
                {t("back")}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
