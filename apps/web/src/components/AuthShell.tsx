import Image from "next/image";
import type { ReactNode } from "react";
import { PHOTOS, type PhotoKey } from "@/lib/photos";

/** Sign-in and reset: the form on a frosted glass card over a full-bleed sports photo. */
export function AuthShell({ photo, children }: { photo: PhotoKey; children: ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden">
      <Image src={PHOTOS[photo]} alt="" fill sizes="100vw" className="-z-20 object-cover" priority />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-band/70 via-band/40 to-band/10" aria-hidden />
      <div className="mx-auto flex min-h-[calc(100dvh-140px)] max-w-[1320px] items-center justify-center px-4 py-10 lg:justify-end lg:px-5">
        <div className="glass-strong w-full max-w-md rounded-[28px]">{children}</div>
      </div>
    </div>
  );
}
