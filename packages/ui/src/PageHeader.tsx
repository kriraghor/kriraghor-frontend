import Image from "next/image";
import type { ReactNode } from "react";

/**
 * A listing page's header: the title block on the left and a photo on the right (a short strip
 * above the title on phones). Works in server and client components. `photo` is the image path in
 * the app's public folder (kriraghor.com keeps its photo list in lib/photos).
 */
export function PageHeader({ photo, children, className = "" }: { photo: string; children: ReactNode; className?: string }) {
  return (
    <div className={`grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,40%)] md:items-center ${className}`}>
      <div className="relative order-first h-36 overflow-hidden rounded-[24px] bg-surface-2 shadow-lg md:order-last md:h-auto md:aspect-[16/10]">
        <Image src={photo} alt="" fill sizes="(min-width: 900px) 40vw, 100vw" className="object-cover" priority />
      </div>
      <div className="glass-card min-w-0 p-6">{children}</div>
    </div>
  );
}
