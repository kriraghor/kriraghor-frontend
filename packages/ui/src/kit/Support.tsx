"use client";

import { useTranslations } from "next-intl";
import { ChatCircleText, EnvelopeSimple, Lifebuoy, LockKey, Phone, WhatsappLogo } from "@phosphor-icons/react";
import { publicEnv } from "@kriraghor/session/env";
import { Notice } from "./Display";

/**
 * Kriraghor support (tester feedback, 19 Nov 2026): the phone, email, WhatsApp and contact page set in
 * each site's runtime config (SUPPORT_PHONE, SUPPORT_EMAIL, SUPPORT_WHATSAPP, SUPPORT_URL). Whatever is
 * not set is left out; the Help page on kriraghor.com is always there. The numbers are shown as text
 * too, so they can be copied where a tel: or mailto: link does nothing.
 */
export function supportContacts() {
  const env = publicEnv();
  const digits = (s: string) => s.replace(/[^\d+]/g, "");
  return {
    phone: env.SUPPORT_PHONE || null,
    email: env.SUPPORT_EMAIL || null,
    whatsapp: env.SUPPORT_WHATSAPP ? digits(env.SUPPORT_WHATSAPP).replace(/^\+/, "") : null,
    whatsappText: env.SUPPORT_WHATSAPP || null,
    url: env.SUPPORT_URL || `${env.WEB_URL.replace(/\/$/, "")}/help`,
  };
}

export function SupportContacts({ className }: { className?: string }) {
  const t = useTranslations("kit.support");
  const c = supportContacts();
  const row = "inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm font-semibold no-underline hover:border-brand";
  return (
    <div className={className} data-testid="support-contacts">
      <p className="text-sm font-semibold">{t("title")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {c.phone ? (
          <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className={row}>
            <Phone size={18} aria-hidden /> {c.phone}
          </a>
        ) : null}
        {c.whatsapp ? (
          <a href={`https://wa.me/${c.whatsapp}`} target="_blank" rel="noopener noreferrer" className={row}>
            <WhatsappLogo size={18} aria-hidden /> {t("whatsapp")} {c.whatsappText}
          </a>
        ) : null}
        {c.email ? (
          <a href={`mailto:${c.email}`} className={row}>
            <EnvelopeSimple size={18} aria-hidden /> {c.email}
          </a>
        ) : null}
        <a href={c.url} className={row} data-testid="support-link">
          {c.phone || c.email || c.whatsapp ? <Lifebuoy size={18} aria-hidden /> : <ChatCircleText size={18} aria-hidden />} {t("contact")}
        </a>
      </div>
    </div>
  );
}

/** The account is suspended (sign-in answers ACCOUNT_SUSPENDED): what it means and who to contact. */
export function AccountLocked({ className }: { className?: string }) {
  const t = useTranslations("kit.support");
  return (
    <div className={className} data-testid="account-locked">
      <Notice tone="error" title={t("lockedTitle")}>
        <span className="flex items-start gap-2">
          <LockKey size={18} aria-hidden className="mt-0.5 shrink-0" /> {t("lockedBody")}
        </span>
      </Notice>
      <SupportContacts className="mt-4" />
    </div>
  );
}

/** A gym Kriraghor suspended (GYM_SUSPENDED): nothing can be changed until it is restored. */
export function GymSuspendedNotice({ owner, className }: { owner: boolean; className?: string }) {
  const t = useTranslations("kit.support");
  return (
    <div className={className} data-testid="gym-suspended">
      <Notice tone="warning" title={t("gymTitle")}>
        {owner ? t("gymOwner") : t("gymStaff")}
      </Notice>
      <SupportContacts className="mt-3" />
    </div>
  );
}
