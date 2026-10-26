import type { ReactNode } from "react";
import { isExternal } from "@kriraghor/session/links";
import { Link } from "../i18n/navigation";

/** A link on this site (client navigation) or to another one (/go/<site>/..., https://...: a plain <a>). */
export function PayLink({ href, className, children, testId }: { href: string; className?: string; children: ReactNode; testId?: string }) {
  if (isExternal(href)) {
    return (
      <a href={href} className={className} data-testid={testId}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} data-testid={testId}>
      {children}
    </Link>
  );
}

/** One wrapper for both pages: the same width and spacing on every site. */
export function PayShell({ children }: { children: ReactNode }) {
  return <section className="mx-auto max-w-xl px-5 pb-16 pt-10">{children}</section>;
}
