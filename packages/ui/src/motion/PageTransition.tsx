import { ViewTransition, type ReactNode } from "react";

/**
 * Page to page (UI v2, ADR-011): the old page fades out and the new one rises in, through React's
 * <ViewTransition> and the browser's View Transitions (no library). Used in each site's
 * app/[locale]/template.tsx, which Next mounts afresh for every top-level page, so moving between
 * Venues and Shop animates while a filter or a refresh inside a page does not. Browsers without View
 * Transitions just swap the page; reduce motion turns it off (styles/motion.css).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="kg-page-in" exit="kg-page-out" default="none">
      {children}
    </ViewTransition>
  );
}
