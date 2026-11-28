"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth";
import { TooltipProvider } from "./kit/Overlay";
import { ToastProvider } from "./kit/Toast";
import { ConfirmProvider } from "./kit/Confirm";
import { UploadTray } from "./kit/UploadTray";
import type { Audience } from "@kriraghor/session/auth";
import { useFormCarry } from "./i18n/form-carry";

export function Providers({ audience = "api", children }: { audience?: Audience; children: ReactNode }) {
  // Typed form text comes back after a language switch (form-carry.ts).
  useFormCarry();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider audience={audience}>
        <TooltipProvider>
          <ToastProvider>
            <ConfirmProvider>
              {children}
              <UploadTray />
            </ConfirmProvider>
          </ToastProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
