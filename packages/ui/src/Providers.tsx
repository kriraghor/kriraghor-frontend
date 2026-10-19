"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth";
import type { Audience } from "@kriraghor/session/auth";

export function Providers({ audience = "api", children }: { audience?: Audience; children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider audience={audience}>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
