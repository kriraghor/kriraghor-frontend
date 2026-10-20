import { Suspense, type ReactNode } from "react";
import { Providers } from "@kriraghor/ui/providers";
import { SiteHeader } from "./SiteHeader";
import { AREAS, type Area } from "@/app.config";

/** Session provider (admin or customer audience) and header for one portal area. */
export function AreaShell({ area, children }: { area: Area; children: ReactNode }) {
  const { audience, header } = AREAS[area];
  return (
    <Providers audience={audience}>
      {/* The header reads the pathname; routes known only at request time (/vendor/grounds/[id]) stream it in. */}
      <Suspense fallback={<HeaderPlaceholder />}>
        <SiteHeader {...header} />
      </Suspense>
      <main id="main" className="flex-1">
        {children}
      </main>
    </Providers>
  );
}

/** Same height as the header, so nothing moves when it streams in. */
function HeaderPlaceholder() {
  return (
    <div className="sticky top-0 z-40 border-b-2 border-line bg-bg" aria-hidden>
      <div className="h-1 bg-brand" />
      <div className="h-16" />
    </div>
  );
}
