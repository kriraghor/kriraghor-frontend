"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { publicEnv } from "@kriraghor/session/env";

type GoogleId = {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: "popup" }) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    };
  };
};

// One script for the whole page, however many buttons mount and re-render.
let loading: Promise<GoogleId | null> | null = null;
function loadGoogle(): Promise<GoogleId | null> {
  const ready = () => (window as unknown as { google?: GoogleId }).google ?? null;
  if (ready()) return Promise.resolve(ready());
  loading ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve(ready());
    script.onerror = () => {
      loading = null;
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Google's own "Continue with Google" button (Google Identity Services, as their branding rules
 * ask), full width of its column. Its credential (an ID token) goes to POST /auth/google. The
 * callback is read through a ref, so re-renders never re-initialise Google or add the script again.
 */
export function GoogleButton({ onCredential, text = "continue_with" }: { onCredential: (idToken: string) => void; text?: "continue_with" | "signin_with" | "signup_with" }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const [failed, setFailed] = useState(false);
  const clientId = publicEnv().GOOGLE_CLIENT_ID;

  useEffect(() => {
    callback.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    const el = ref.current;
    if (!clientId || !el) return;
    let cancelled = false;
    void loadGoogle().then((g) => {
      if (cancelled) return;
      if (!g) return setFailed(true);
      g.accounts.id.initialize({ client_id: clientId, callback: (r) => callback.current(r.credential), ux_mode: "popup" });
      // Google draws 200–400px wide; match the column.
      const width = Math.max(200, Math.min(400, Math.floor(el.getBoundingClientRect().width)));
      g.accounts.id.renderButton(el, { type: "standard", theme: "outline", size: "large", shape: "pill", text, logo_alignment: "center", width, locale });
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, text, locale]);

  if (!clientId || failed) return <p className="rounded-control border border-dashed border-line px-4 py-3 text-center text-sm text-muted">{t("googleUnavailable")}</p>;
  // Reserve Google's 44px so nothing jumps when the button arrives.
  return <div ref={ref} className="flex min-h-11 w-full justify-center [color-scheme:light]" data-testid="google-button" />;
}
