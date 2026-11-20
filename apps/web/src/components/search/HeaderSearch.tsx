"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";

/**
 * The header's platform search (tester feedback, 19 Nov 2026): one box at every size that fills the middle of
 * the header and grows with the screen (the header caps it), with a search button at the end. It goes to
 * /search?q=; the search page has its own box, so the header leaves it out there.
 */
export function HeaderSearch() {
  const t = useTranslations("search");
  const router = useRouter();
  const pathname = usePathname();
  // The full hint where it fits (from `sm`); phones get the short label so it isn't cut off.
  const [roomy, setRoomy] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setRoomy(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  if (pathname === "/search") return null;
  return (
    <form
      role="search"
      action="/search"
      className="group relative flex h-11 w-full items-center rounded-pill border border-line bg-surface shadow-[0_1px_2px_rgb(15_23_20/0.06)] transition-[border-color,box-shadow] focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgb(11_122_75/0.15)]"
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
      }}
    >
      <MagnifyingGlass size={18} aria-hidden className="pointer-events-none absolute left-4 text-muted transition-colors group-focus-within:text-brand-text" />
      <input
        name="q"
        type="search"
        aria-label={t("label")}
        placeholder={roomy ? t("hint") : t("label")}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={60}
        className="h-full min-w-0 flex-1 rounded-pill bg-transparent pl-11 pr-2 text-base text-ink outline-none placeholder:text-muted sm:text-[15px] [&::-webkit-search-cancel-button]:hidden"
        data-testid="header-search"
      />
      <button type="submit" className="mr-1 hidden h-9 shrink-0 cursor-pointer items-center rounded-pill bg-brand px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover active:scale-95 sm:inline-flex" data-testid="header-search-go">
        {t("go")}
      </button>
    </form>
  );
}
