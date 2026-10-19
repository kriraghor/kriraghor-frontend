"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { api } from "@kriraghor/api-client";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * The signed-in staff member for an admin desk. Anyone without an admin session is sent to the
 * staff sign-in. This only shapes the UI; the API enforces every permission (ADR-004).
 */
export function useAdminMe() {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "signed_out") router.replace("/admin/sign-in");
  }, [status, router]);

  const me = useQuery({
    queryKey: ["admin-me"],
    enabled: status === "signed_in",
    queryFn: async () => {
      const { data, error } = await api("admin").GET("/admin/me");
      if (error) throw error;
      return data;
    },
  });
  return { ready: status === "signed_in" && Boolean(me.data), me: me.data };
}

/** Format a timestamp in Dhaka time for the current locale. */
export function formatDhaka(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso));
}
