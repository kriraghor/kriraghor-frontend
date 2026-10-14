import type { ReactNode } from "react";
import { Providers } from "./Providers";
import { SiteHeader } from "./SiteHeader";
import { AREAS, type Area } from "@/app.config";

/** Session provider (admin or customer audience) and header for one portal area. */
export function AreaShell({ area, children }: { area: Area; children: ReactNode }) {
  const { audience, header } = AREAS[area];
  return (
    <Providers audience={audience}>
      <SiteHeader {...header} />
      <main id="main" className="flex-1">
        {children}
      </main>
    </Providers>
  );
}
