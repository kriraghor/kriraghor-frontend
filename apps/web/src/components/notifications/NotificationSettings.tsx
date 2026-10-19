"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api, problemOf } from "@kriraghor/api-client";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { components } from "@kriraghor/api-client/schema";
import { Button, Notice } from "../ui";

type Prefs = components["schemas"]["NotificationPrefs"];
const CHANNELS = ["in_app", "sms", "email"] as const;

/**
 * Notification preferences (M08 §4.3): rows = kinds of update, columns = In-app · SMS · Email.
 * Mandatory cells are locked ("Required for your security and payments"); quiet hours toggle.
 */
export function NotificationSettings({ signInHref }: { signInHref: string }) {
  const t = useTranslations("notifications");
  const qc = useQueryClient();
  const { status } = useAuth();
  const [draft, setDraft] = useState<Prefs | null>(null);
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["notification-prefs"],
    enabled: status === "signed_in",
    queryFn: async () => {
      const { data, error } = await api("api").GET("/me/notification-prefs");
      if (error || !data) throw error;
      return data;
    },
  });
  // Unsaved edits, falling back to what the server has.
  const current = draft ?? q.data ?? null;

  if (status === "signed_out") {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12">
        <Notice>
          {t("signedOut")}{" "}
          <Link href={signInHref} className="underline">
            {t("signIn")}
          </Link>
        </Notice>
      </div>
    );
  }
  if (!current) {
    return (
      <p className="px-5 py-12 text-muted" role="status">
        {t("loading")}
      </p>
    );
  }

  const toggle = (category: string, channel: string) =>
    setDraft(() =>
      current
        ? {
            ...current,
            categories: current.categories.map((c) =>
              c.category !== category ? c : { ...c, channels: c.channels.map((x) => (x.channel === channel && !x.locked ? { ...x, enabled: !x.enabled } : x)) }
            ),
          }
        : null
    );

  async function save() {
    if (!current || !q.data) return;
    setBusy(true);
    setNotice(null);
    const before = new Map(q.data.categories.flatMap((c) => c.channels.map((x) => [`${c.category}:${x.channel}`, x.enabled] as const)));
    const prefs = current.categories.flatMap((c) =>
      c.channels.filter((x) => x.offered && !x.locked && before.get(`${c.category}:${x.channel}`) !== x.enabled).map((x) => ({ category: c.category, channel: x.channel, enabled: x.enabled }))
    );
    const { data, error } = await api("api").PUT("/me/notification-prefs", { body: { prefs, quietHours: current.quietHours } });
    setBusy(false);
    if (error || !data) {
      setNotice({ tone: "error", text: problemOf(error)?.title ?? "Error" });
      return;
    }
    qc.setQueryData(["notification-prefs"], data);
    setDraft(null);
    setNotice({ tone: "info", text: t("prefs.saved") });
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <h1 className="text-3xl font-extrabold">{t("prefs.title")}</h1>
      <p className="mt-2 text-muted">{t("prefs.intro")}</p>

      <div className="mt-6 overflow-x-auto glass-card">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b-2 border-line">
            <tr>
              <th scope="col" className="px-4 py-3">
                {t("prefs.category")}
              </th>
              {CHANNELS.map((ch) => (
                <th key={ch} scope="col" className="px-4 py-3 text-center">
                  {t(`prefs.channels.${ch}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {current.categories.map((c) => (
              <tr key={c.category}>
                <th scope="row" className="px-4 py-3 font-semibold">
                  {t(`categories.${c.category}` as never)}
                </th>
                {CHANNELS.map((ch) => {
                  const cell = c.channels.find((x) => x.channel === ch)!;
                  const label = `${t(`categories.${c.category}` as never)}: ${t(`prefs.channels.${ch}`)}`;
                  return (
                    <td key={ch} className="px-4 py-3 text-center">
                      {cell.offered ? (
                        <span className="inline-flex items-center gap-1" title={cell.locked ? t("prefs.locked") : undefined}>
                          <input
                            type="checkbox"
                            checked={cell.enabled}
                            disabled={cell.locked}
                            onChange={() => toggle(c.category, ch)}
                            aria-label={cell.locked ? `${label} (${t("prefs.locked")})` : label}
                            className="size-5 accent-brand disabled:opacity-60"
                          />
                          {cell.locked ? (
                            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="5" y="11" width="14" height="10" rx="1" />
                              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                            </svg>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted" title={t("prefs.notOffered")} aria-label={t("prefs.notOffered")}>
                          –
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <label className="mt-6 flex min-h-11 items-start gap-3">
        <input type="checkbox" checked={current.quietHours} onChange={(e) => setDraft({ ...current, quietHours: e.target.checked })} className="mt-1 size-5 accent-brand" />
        <span>
          <span className="block font-semibold">{t("prefs.quietHours", { start: current.quietWindow.start, end: current.quietWindow.end })}</span>
          <span className="block text-sm text-muted">{t("prefs.quietHoursHelp")}</span>
        </span>
      </label>
      <p className="mt-4 text-sm">
        <span className="font-semibold">{t("prefs.language")}:</span> {current.locale === "bn" ? "বাংলা" : "English"} <span className="text-muted">({t("prefs.languageHelp")})</span>
      </p>

      {notice ? (
        <div className="mt-4">
          <Notice tone={notice.tone}>{notice.text}</Notice>
        </div>
      ) : null}
      <div className="mt-6">
        <Button type="button" busy={busy} onClick={() => void save()}>
          {t("prefs.save")}
        </Button>
      </div>
    </div>
  );
}
