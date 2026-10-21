"use client";

import { useSyncExternalStore } from "react";
import { FacebookLogo, LinkSimple, MessengerLogo, ShareNetwork, WhatsappLogo, XLogo } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { Button, IconButton } from "../kit/Button";
import { Menu } from "../kit/Overlay";
import { useToast } from "../kit/Toast";
import { copyText, isMobileUserAgent, shareLinks, withRef, type ShareTarget } from "./links";

export { copyText, isMobileUserAgent, shareLinks, whatsappUrl, withRef, type ShareLink, type ShareTarget } from "./links";

type Props = {
  /** The page's absolute URL (`?ref=share` is added here). */
  url: string;
  /** The page's name: the native sheet's title and the start of the WhatsApp and X message. */
  title: string;
  /** A line after the title in the native sheet (optional). */
  text?: string | null;
  /** A labelled button (default) or a square icon button. */
  variant?: "button" | "icon";
  testId?: string;
  className?: string;
};

const noSubscribe = () => () => undefined;
const hasNativeShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";
const isMobile = () => typeof navigator !== "undefined" && isMobileUserAgent(navigator.userAgent);

const ICONS: Record<ShareTarget, typeof WhatsappLogo> = { whatsapp: WhatsappLogo, facebook: FacebookLogo, messenger: MessengerLogo, x: XLogo };

/**
 * Share a public page: the device's own share sheet where there is one (phones), otherwise a menu
 * with Copy link, WhatsApp, Facebook, Messenger (phones only) and X. The server renders the menu
 * button; the native sheet takes over after hydration.
 */
export function ShareButton({ url, title, text, variant = "button", testId = "share", className }: Props) {
  const t = useTranslations("kit.share");
  const toast = useToast();
  const native = useSyncExternalStore(noSubscribe, hasNativeShare, () => false);
  const mobile = useSyncExternalStore(noSubscribe, isMobile, () => false);
  const shared = withRef(url);

  async function copy() {
    if (await copyText(shared)) toast.show(t("copied"));
    else toast.show(t("copyFailed"), "error");
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: text ?? undefined, url: shared });
    } catch (err) {
      // Closing the sheet is not an error; anything else (not allowed here) falls back to copying.
      if ((err as { name?: string } | null)?.name !== "AbortError") await copy();
    }
  }

  const trigger =
    variant === "icon" ? (
      <IconButton label={t("label")} variant="secondary" className={className} data-testid={testId} onClick={native ? nativeShare : undefined}>
        <ShareNetwork size={20} aria-hidden />
      </IconButton>
    ) : (
      <Button type="button" variant="secondary" icon={<ShareNetwork size={18} aria-hidden />} className={className} data-testid={testId} onClick={native ? nativeShare : undefined}>
        {t("label")}
      </Button>
    );

  if (native) return trigger;

  const open = (href: string, app: boolean) => {
    // App links (fb-messenger://) replace the page briefly; web links open a new tab.
    if (app) window.location.assign(href);
    else window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <Menu
      trigger={trigger}
      items={[
        { label: t("copy"), icon: <LinkSimple aria-hidden />, onSelect: () => void copy() },
        "separator",
        ...shareLinks(shared, title, { mobile }).map((l) => {
          const Icon = ICONS[l.key];
          return { label: t(l.key), icon: <Icon aria-hidden />, onSelect: () => open(l.href, l.key === "messenger") };
        }),
      ]}
    />
  );
}
