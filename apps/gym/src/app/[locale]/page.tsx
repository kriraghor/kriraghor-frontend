import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Barbell, BellRinging, CalendarCheck, CurrencyCircleDollar, IdentificationBadge, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Pricing } from "@/components/home/Pricing";

/**
 * gym.kriraghor.com home (M24 prompt 0): what the gym system does for an owner (members, fees,
 * attendance, reminders, staff, workout plans), "Start free" (/start), and the way to the gym hub for
 * members. Prices come from the public settings (components/home/Pricing), never from this page.
 */
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const features = [
    { key: "members", icon: UsersThree },
    { key: "fees", icon: CurrencyCircleDollar },
    { key: "attendance", icon: CalendarCheck },
    { key: "reminders", icon: BellRinging },
    { key: "staff", icon: IdentificationBadge },
    { key: "plans", icon: Barbell },
  ] as const;

  return (
    <>
      <section className="mx-auto grid max-w-[1320px] gap-8 px-5 pb-10 pt-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center md:pt-16">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">{t("kicker")}</p>
          <h1 className="mt-3 max-w-3xl font-gym text-5xl font-black uppercase leading-[1.02] tracking-tight md:text-7xl" data-testid="home-title">
            {t.rich("title", { em: (chunks) => <span className="text-brand">{chunks}</span> })}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">{t("lead")}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/start" className="inline-flex min-h-12 items-center gap-2 bg-brand px-6 font-bold text-on-brand no-underline hover:bg-brand-hover" data-testid="start-free">
              {t("startFree")} <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href="/gyms" className="inline-flex min-h-12 items-center border-2 border-line px-6 font-bold no-underline hover:border-brand" data-testid="find-gym">
              {t("findGym")}
            </Link>
          </div>
        </div>
        <div className="relative order-first h-56 overflow-hidden rounded-[24px] bg-surface-2 shadow-lg md:order-last md:h-auto md:aspect-[4/3]">
          <Image src="/images/gym-training.jpg" alt="" fill sizes="(min-width: 900px) 45vw, 100vw" className="object-cover" priority />
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-10" aria-labelledby="features-title">
        <h2 id="features-title" className="text-3xl font-extrabold md:text-4xl">
          {t("featuresTitle")}
        </h2>
        <p className="mt-2 max-w-2xl text-muted">{t("featuresLead")}</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="features">
          {features.map(({ key, icon: Icon }) => (
            <li key={key} className="glass-card flex flex-col gap-3 p-5">
              <span className="flex size-11 items-center justify-center rounded-pill bg-brand-soft text-brand-text">
                <Icon size={24} aria-hidden />
              </span>
              <h3 className="text-xl font-extrabold">{t(`features.${key}.title`)}</h3>
              <p className="text-muted">{t(`features.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <Pricing />

      <section className="mx-auto max-w-[1320px] px-5 py-10" aria-labelledby="members-title">
        <div className="glass-card flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="members-title" className="text-2xl font-extrabold">
              {t("membersTitle")}
            </h2>
            <p className="mt-1 max-w-2xl text-muted">{t("membersLead")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/gyms" className="inline-flex min-h-12 items-center bg-brand px-5 font-bold text-on-brand no-underline hover:bg-brand-hover">
              {t("findGym")}
            </Link>
            <Link href="/gyms?tab=trainers" className="inline-flex min-h-12 items-center border-2 border-line px-5 font-bold no-underline hover:border-brand">
              {t("findTrainer")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
