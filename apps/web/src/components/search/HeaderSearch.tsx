"use client";

import { useTranslations } from "next-intl";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Link, usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";

/** The header's platform search: a box on wide screens, an icon to /search on smaller ones. */
export function HeaderSearch() {
  const t = useTranslations("search");
  const router = useRouter();
  const pathname = usePathname();
  // The search page has its own box.
  if (pathname === "/search") return null;
  return (
    <>
      <form
        role="search"
        action="/search"
        className="relative hidden xl:block"
        onSubmit={(e) => {
          e.preventDefault();
          const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
          router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
        }}
      >
        <MagnifyingGlass size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input name="q" type="search" aria-label={t("label")} placeholder={t("short")} autoComplete="off" enterKeyHint="search" maxLength={60} className="h-10 w-36 field pl-9 pr-2 text-sm text-ink" data-testid="header-search" />
      </form>
      <Link href="/search" aria-label={t("label")} className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-ink transition-colors hover:bg-surface-2 xl:hidden" data-testid="header-search-link">
        <MagnifyingGlass size={21} aria-hidden />
      </Link>
    </>
  );
}
