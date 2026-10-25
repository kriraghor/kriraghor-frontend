import Image from "next/image";
import type { ReactNode } from "react";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";

export type AuthBrand = "web" | "esports" | "vendor" | "admin" | "gym";

/**
 * Sign-in, sign-up and reset pages: a brand panel (photo, promise, three reasons) beside the form
 * on desktop; on phones the form comes first under a slim strip. The form never sits on a photo.
 */
export async function AuthLayout({ brand, image, children }: { brand: AuthBrand; image?: string; children: ReactNode }) {
  const t = await getTranslations("auth.panel");
  const points = [t(`${brand}.p1`), t(`${brand}.p2`), t(`${brand}.p3`)];
  return (
    <div className="mx-auto grid w-full max-w-wide lg:min-h-[calc(100dvh-68px)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10 lg:p-5">
      <aside className="relative isolate hidden overflow-hidden rounded-card bg-band text-band-text lg:flex lg:flex-col lg:justify-end">
        {image ? <Image src={image} alt="" fill sizes="(min-width: 1180px) 50vw, 0px" className="-z-20 object-cover" priority /> : null}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-band via-band/75 to-band/20" aria-hidden />
        <div className="p-10 xl:p-12">
          <p className="max-w-[18ch] font-display text-4xl font-bold leading-tight xl:text-5xl">{t(`${brand}.title`)}</p>
          <ul className="mt-8 flex flex-col gap-3.5">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-base text-band-text/90">
                <CheckCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-green-400" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex flex-col">
        <p className="bg-band px-5 py-3 text-center font-display text-sm font-semibold text-band-text lg:hidden">{t(`${brand}.title`)}</p>
        <div className="flex flex-1 items-start justify-center px-5 pb-16 pt-8 sm:pt-12 lg:items-center lg:py-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
