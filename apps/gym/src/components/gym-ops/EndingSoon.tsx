"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Phone, WhatsappLogo } from "@phosphor-icons/react";
import { Badge, Card, IconButton, useToast } from "@kriraghor/ui/kit";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { cn } from "@kriraghor/ui/cn";
import { gymManage, type Overview } from "@/lib/gym-manage";
import { telUrl, whatsappUrl } from "@/lib/gym-ops";
import { useFmt, useGymError, type GymCtx } from "../gym-manage/common";

type Ending = Overview["expiring"][number];
type Mix = Overview["mix"];

/**
 * The dashboard's "Ending soon" (M27-FR-32): memberships that end within a few days and are not renewed,
 * soonest first. Staff with members.edit get Call and WhatsApp: the number comes from the audited reveal
 * (M24-FR-12) at the moment of the tap, never kept on the page; WhatsApp opens with a renewal message in
 * the language of the app. Others see the list and open the member.
 */
export function EndingSoon({ ctx, items }: { ctx: GymCtx; items: Ending[] }) {
  const t = useTranslations("go");
  const f = useFmt();
  const err = useGymError();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const canChat = ctx.can("members.edit");
  const reach = async (m: Ending, how: "call" | "whatsapp") => {
    setBusy(`${m.memberId}:${how}`);
    try {
      const { phone } = await gymManage.revealPhone(ctx.gymId, m.memberId);
      if (how === "call") {
        window.location.assign(telUrl(phone));
        return;
      }
      const url = whatsappUrl(phone, t("ending.message", { name: m.displayName.split(" ")[0], gym: ctx.gym.name, date: f.date(m.endsOn) }));
      if (!url) return toast.show(t("ending.noWhatsapp"), "error");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.show(err(e), "error");
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card padded={false} data-testid="dash-ending">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="font-display text-lg font-bold">{t("ending.title")}</h2>
        <span className="text-sm text-muted">{t("ending.count", { n: f.n(items.length) })}</span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted">{t("ending.none")}</p>
      ) : (
        <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto">
          {items.map((m) => (
            <li key={m.memberId} className="flex items-center gap-3 px-4 py-2.5">
              <Link href={`/manage/${ctx.gymId}/members/${m.memberId}`} className="min-w-0 flex-1 no-underline">
                <span className="block truncate font-semibold text-ink">{m.displayName}</span>
                <span className="block text-xs text-muted">
                  {m.memberCode} · {f.date(m.endsOn)}
                </span>
              </Link>
              <Badge tone={m.daysLeft <= 1 ? "danger" : m.daysLeft <= 3 ? "warning" : "neutral"}>{m.daysLeft === 0 ? t("ending.today") : t("ending.inDays", { n: f.n(m.daysLeft) })}</Badge>
              {canChat ? (
                <span className="flex gap-1">
                  <IconButton variant="secondary" label={t("ending.call", { name: m.displayName })} onClick={() => void reach(m, "call")} disabled={busy !== null} data-testid={`ending-call-${m.memberCode}`}>
                    <Phone size={18} aria-hidden className={cn(busy === `${m.memberId}:call` && "animate-pulse")} />
                  </IconButton>
                  <IconButton variant="secondary" label={t("ending.whatsapp", { name: m.displayName })} onClick={() => void reach(m, "whatsapp")} disabled={busy !== null} data-testid={`ending-wa-${m.memberCode}`}>
                    <WhatsappLogo size={18} aria-hidden className={cn(busy === `${m.memberId}:whatsapp` && "animate-pulse")} />
                  </IconButton>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** The dashboard's membership mix (M27-FR-33): members by status as one bar and a legend. */
export function MemberMix({ mix }: { mix: Mix }) {
  const t = useTranslations("go");
  const f = useFmt();
  const parts: { key: keyof Mix; cls: string }[] = [
    { key: "active", cls: "bg-brand" },
    { key: "new", cls: "bg-info" },
    { key: "frozen", cls: "bg-line-strong" },
    { key: "expired", cls: "bg-warning" },
    { key: "left", cls: "bg-danger" },
  ];
  const total = parts.reduce((n, p) => n + mix[p.key], 0);
  return (
    <Card className="flex flex-col gap-3" data-testid="dash-mix">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-bold">{t("mix.title")}</h2>
        <span className="text-sm text-muted">{t("mix.total", { n: f.n(total) })}</span>
      </div>
      {total > 0 ? (
        <div className="flex h-3 overflow-hidden rounded-pill bg-surface-2" role="img" aria-label={parts.map((p) => `${t(`mix.${p.key}`)} ${mix[p.key]}`).join(", ")}>
          {parts.map((p) => (mix[p.key] ? <span key={p.key} className={p.cls} style={{ width: `${(mix[p.key] / total) * 100}%` }} /> : null))}
        </div>
      ) : null}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span className={cn("size-2.5 shrink-0 rounded-full", p.cls)} aria-hidden />
            <span className="text-muted">{t(`mix.${p.key}`)}</span>
            <span className="ml-auto font-semibold tabular-nums">{f.n(mix[p.key])}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
