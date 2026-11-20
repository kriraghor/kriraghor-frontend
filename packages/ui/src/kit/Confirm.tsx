"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { Dialog } from "./Overlay";

/**
 * Confirm before a change (tester feedback, 19 Nov 2026: every add, edit, remove and money action asks
 * first). `kind` picks the standard words; `title` and `body` say exactly what will happen.
 */
export type ConfirmKind = "save" | "add" | "remove" | "money" | "send";
export type ConfirmSpec = ConfirmKind | { kind?: ConfirmKind; title?: ReactNode; body?: ReactNode; confirmLabel?: ReactNode; danger?: boolean };

type Ask = (spec: ConfirmSpec) => Promise<boolean>;

// Without a provider (unit tests, isolated widgets) nothing is asked.
const ConfirmContext = createContext<Ask>(async () => true);

/** The function that opens the confirm dialog and resolves true (confirmed) or false (cancelled). */
export function useConfirm(): Ask {
  return useContext(ConfirmContext);
}

const norm = (spec: ConfirmSpec) => (typeof spec === "string" ? { kind: spec } : spec);

/** One confirm dialog for the whole app; mounted by the shared Providers. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("kit.confirm");
  const [open, setOpen] = useState<{ spec: Exclude<ConfirmSpec, ConfirmKind> } | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback<Ask>((spec) => {
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpen({ spec: norm(spec) });
    });
  }, []);

  const settle = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(null);
  };

  const spec = open?.spec;
  const kind = spec?.kind ?? "save";
  const danger = spec?.danger ?? kind === "remove";
  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <Dialog
        open={Boolean(open)}
        onOpenChange={(o) => {
          if (!o) settle(false);
        }}
        title={spec?.title ?? t(`${kind}.title`)}
        description={spec?.body ?? t(`${kind}.body`)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => settle(false)} data-testid="confirm-cancel">
              {t("cancel")}
            </Button>
            <Button type="button" variant={danger ? "danger" : "primary"} onClick={() => settle(true)} autoFocus data-testid="confirm-ok">
              {spec?.confirmLabel ?? t(`${kind}.yes`)}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}
