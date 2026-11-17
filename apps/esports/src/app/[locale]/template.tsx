import type { ReactNode } from "react";
import { PageTransition } from "@kriraghor/ui/page-transition";

/** Mounted afresh for every top-level page, so moving between pages animates (UI v2, ADR-011). */
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}