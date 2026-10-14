"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { getAccessToken, hasSessionHint, refresh, setAccessToken, type Audience } from "./session";

type Status = "loading" | "signed_in" | "signed_out";
type AuthContext = {
  audience: Audience;
  status: Status;
  /** Store the access token from a sign-in response. */
  signedIn: (accessToken: string) => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthContext | null>(null);

/**
 * Restores the session on load (SSO across subdomains, ADR-004): if the hint cookie says a session
 * exists, one refresh gets a fresh access token from the shared API host.
 */
export function AuthProvider({ audience = "api", children }: { audience?: Audience; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (getAccessToken(audience)) return setStatus("signed_in");
      const token = hasSessionHint(audience) ? await refresh(audience) : null;
      if (!cancelled) setStatus(token ? "signed_in" : "signed_out");
    })();
    return () => {
      cancelled = true;
    };
  }, [audience]);

  const signedIn = useCallback(
    (accessToken: string) => {
      setAccessToken(accessToken, audience);
      setStatus("signed_in");
      void queryClient.invalidateQueries();
    },
    [audience, queryClient]
  );

  const signOut = useCallback(async () => {
    await api(audience)
      .POST(audience === "admin" ? "/auth/admin/logout" : "/auth/logout", {})
      .catch(() => undefined);
    setAccessToken(null, audience);
    queryClient.clear();
    setStatus("signed_out");
  }, [audience, queryClient]);

  const value = useMemo(() => ({ audience, status, signedIn, signOut }), [audience, status, signedIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
