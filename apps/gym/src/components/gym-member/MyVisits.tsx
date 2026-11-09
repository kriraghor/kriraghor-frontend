"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { ArrowsOut, Footprints, MapPin } from "@phosphor-icons/react";
import { useAuth } from "@kriraghor/ui/auth";
import { SignedOutCard } from "@kriraghor/ui/account";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Badge, Button, ButtonLink, Dialog, EmptyState, Notice, Skeleton, useToast } from "@kriraghor/ui/kit";
import { nextDays } from "@/lib/manage";
import { codeGroups, dhakaMinuteNow, gymVisits, splitVisits, visitAhead, type MyVisit } from "@/lib/gym-visits";
import { useFmt, useGymError } from "@/components/gym-manage/common";

const TONE: Record<MyVisit["status"], "brand" | "info" | "neutral" | "warning"> = { booked: "brand", attended: "info", cancelled: "neutral", no_show: "warning" };

/**
 * /me/visits (M24-FR-112, 9 Nov 2026): my free trial visits. A booked visit shows its QR (no-store, read
 * fresh) and the 6-character code to read out at the desk, the day and time, the gym's address, and Cancel up
 * to the gym's cutoff; past, attended, cancelled (with the gym's reason) and missed visits follow.
 */
export function MyVisits() {
  const t = useTranslations("gv");
  const params = useSearchParams();
  const { status } = useAuth();
  const err = useGymError();
  const q = useQuery({ queryKey: ["my-gym-visits"], queryFn: () => gymVisits.mine(), enabled: status === "signed_in" });
  if (status === "signed_out") return <SignedOutCard signInHref="/sign-in?next=/me/visits" />;
  const { coming, past } = splitVisits(q.data?.items ?? []);
  return (
    <section className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-6 md:py-10" data-testid="me-visits-page">
      <h1 className="font-display text-3xl font-extrabold">{t("me.title")}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{t("me.lead")}</p>
      {params.get("booked") ? (
        <Notice tone="success" className="mt-4" title={t("me.bookedTitle")}>
          {t("me.bookedBody")}
        </Notice>
      ) : null}
      <div className="mt-6">
        {q.isPending ? (
          <Skeleton className="h-80 rounded-card" />
        ) : q.isError ? (
          <Notice tone="error">{err(q.error)}</Notice>
        ) : !coming.length && !past.length ? (
          <EmptyState icon={<Footprints size={32} aria-hidden />} title={t("me.none")} body={t("me.noneBody")} action={<ButtonLink href="/gyms">{t("me.findGym")}</ButtonLink>} />
        ) : (
          <div className="flex flex-col gap-8">
            {coming.map((v) => (
              <VisitTicket key={v.id} v={v} />
            ))}
            {past.length ? (
              <div>
                <h2 className="font-display text-xl font-extrabold">{t("me.history")}</h2>
                <ul className="mt-3 divide-y divide-line border-y border-line" data-testid="me-visits-history">
                  {past.map((v) => (
                    <PastRow key={v.id} v={v} />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

/** One booked visit: the QR and code for the desk, when and where, and Cancel. */
function VisitTicket({ v }: { v: MyVisit }) {
  const t = useTranslations("gv");
  const f = useFmt();
  const err = useGymError();
  const toast = useToast();
  const qc = useQueryClient();
  const box = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [today] = useState(() => nextDays(1)[0]);
  const ahead = visitAhead(v, { today, nowMinute: dhakaMinuteNow() });
  useEffect(() => {
    if (!v.token) return;
    let live = true;
    QRCode.toDataURL(v.token, { errorCorrectionLevel: "M", margin: 2, width: 640, color: { dark: "#111210", light: "#ffffff" } }).then((u) => live && setSrc(u));
    return () => {
      live = false;
    };
  }, [v.token]);
  const cancel = useMutation({
    mutationFn: () => gymVisits.cancelMine(v.id),
    onSuccess: (data) => {
      qc.setQueryData(["my-gym-visits"], data);
      setAsking(false);
      toast.show(t("me.cancelled"), "success");
    },
    onError: (e) => toast.show(err(e), "error"),
  });
  const full = () => {
    const el = box.current;
    if (el && document.fullscreenElement !== el) void el.requestFullscreen?.().catch(() => undefined);
  };
  const gym = v.gym?.name ?? "";
  return (
    <article className="grid gap-5 rounded-card border-2 border-brand/40 p-4 sm:grid-cols-[minmax(0,280px)_minmax(0,1fr)] sm:p-5" data-testid="visit-ticket">
      <div ref={box} className="flex flex-col items-center justify-center gap-2 rounded-card bg-white p-3 text-[#111210] [&:fullscreen]:rounded-none" data-testid="visit-qr">
        <p className="text-center font-extrabold">{gym}</p>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={t("me.qrAlt", { gym })} className="aspect-square w-full max-w-[min(80vh,480px)]" />
        ) : (
          <div className="aspect-square w-full max-w-[280px] animate-pulse rounded-control bg-neutral-200" />
        )}
        {v.code ? (
          <p className="font-mono text-2xl font-bold tracking-[0.2em] tabular-nums" data-testid="visit-code" aria-label={t("me.codeAria", { code: v.code.split("").join(" ") })}>
            {codeGroups(v.code)}
          </p>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <Badge tone="brand" className="self-start">
          {t("status.booked")}
        </Badge>
        <div>
          <p className="text-2xl font-extrabold">
            {v.date === today ? t("form.today") : `${f.weekday(v.date)}, ${f.short(v.date)}`} · <span className="tabular-nums">{v.arriveAt}</span>
          </p>
          {v.gym ? (
            <Link href={`/gyms/${encodeURIComponent(v.gym.slug)}`} className="mt-1 inline-flex items-center gap-1.5 font-semibold text-brand-text hover:underline">
              <MapPin size={16} aria-hidden /> {v.gym.name}
            </Link>
          ) : null}
          {v.gym?.addressLine ? <p className="text-sm text-muted">{v.gym.addressLine}</p> : null}
        </div>
        <p className="text-sm">{t("me.howTo")}</p>
        <div className="mt-auto flex flex-wrap gap-2">
          <Button type="button" variant="secondary" icon={<ArrowsOut size={18} aria-hidden />} onClick={full} data-testid="visit-full">
            {t("me.fullScreen")}
          </Button>
          {ahead ? (
            <Button type="button" variant="ghost" onClick={() => setAsking(true)} data-testid="visit-cancel">
              {t("me.cancel")}
            </Button>
          ) : null}
        </div>
      </div>
      <Dialog
        open={asking}
        onOpenChange={setAsking}
        title={t("me.cancelTitle")}
        description={t("me.cancelBody", { gym })}
        footer={
          <div className="flex flex-wrap justify-end gap-2" data-testid="visit-cancel-dialog">
            <Button type="button" variant="ghost" onClick={() => setAsking(false)}>
              {t("me.keep")}
            </Button>
            <Button type="button" variant="danger" busy={cancel.isPending} onClick={() => cancel.mutate()} data-testid="visit-cancel-confirm">
              {t("me.cancelConfirm")}
            </Button>
          </div>
        }
      />
    </article>
  );
}

function PastRow({ v }: { v: MyVisit }) {
  const t = useTranslations("gv");
  const f = useFmt();
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm" data-testid="visit-past" data-status={v.status}>
      <span className="w-24 shrink-0 font-semibold tabular-nums">
        {f.short(v.date)} · {v.arriveAt}
      </span>
      <span className="min-w-0 flex-1 truncate font-semibold">{v.gym?.name ?? ""}</span>
      <Badge tone={TONE[v.status]}>{v.status === "cancelled" && v.cancelledBy === "gym" ? t("status.cancelledByGym") : t(`status.${v.status}`)}</Badge>
      {v.status === "cancelled" && v.cancelledBy === "gym" && v.cancelReason ? <p className="basis-full text-muted">{t("me.reason", { reason: v.cancelReason })}</p> : null}
    </li>
  );
}
