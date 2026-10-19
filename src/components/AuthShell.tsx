import Image from "next/image";
import type { ReactNode } from "react";
import { PHOTOS, type PhotoKey } from "@/lib/photos";

/** Sign-in and reset: the form, with a sports photo beside it on wide screens. */
export function AuthShell({ photo, children }: { photo: PhotoKey; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[1320px] lg:grid-cols-2 lg:items-stretch lg:gap-10 lg:px-5 lg:py-10">
      <div className="relative hidden min-h-[560px] overflow-hidden lg:block">
        <Image src={PHOTOS[photo]} alt="" fill sizes="50vw" className="object-cover" priority />
      </div>
      <div className="flex items-center">{children}</div>
    </div>
  );
}
