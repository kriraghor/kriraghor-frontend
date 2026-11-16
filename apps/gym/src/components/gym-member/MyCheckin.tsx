"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { ArrowsOut, Sun } from "@phosphor-icons/react";
import { useAuth } from "@kriraghor/ui/auth";
import { SignedOutCard } from "@kriraghor/ui/account";
import { usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";
import { Button, ButtonLink, EmptyState, Notice, SegmentedControl, Skeleton } from "@kriraghor/ui/kit";
import { gymMe, qrRefreshIn, type CheckinToken } from "@/lib/gym-manage";
import { useGymError } from "@/components/gym-manage/common";
import { EntranceScan } from "./EntranceScan";

/**
 * /me/checkin (M24-FR-50): my rotating check-in QR for a gym, full screen at the desk. The token is
 * valid for one window (gym_manage.member_qr_seconds) and holds no personal data; the page fetches a
 * new one a few seconds before it ends (the desk also accepts the previous one). One QR per gym I am
 * linked to (?m=memberId picks it). Below it, the entrance self check-in (EntranceScan, M24-FR-51,
 * prompt 3): first on the page when it was opened from the door's QR.
 */
export function MyCheckin() {
  const t = useTranslations("gm");
  const { status } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const list = useQuery({ queryKey: ["my-gym-memberships"], queryFn: () => gymMe.memberships(), enabled: status === "signed_in" });
  // Opened from the entrance tablet's QR (?e=): the check-in comes first. Kept for the visit, since the
  // scan drops ?e= from the URL once it is sent.
  const [fromDoor] = useState(() => Boolean(params.get("e")));
  if (status === "signed_out") return <SignedOutCard signInHref={`/sign-in?next=${encodeURIComponent(params.get("e") ? `/me/checkin?e=${params.get("e")}` : "/me/checkin")}`} />;
  const linked = (list.data?.items ?? []).filter((m) => m.linked && m.status !== "removed" && m.status !== "left");
  const chosen = linked.find((m) => m.memberId === params.get("m")) ?? linked[0];
  return (
    <section className="mx-auto w-full max-w-[560px] px-4 py-6 sm:px-6" data-testid="me-checkin-page">
      <h1 className="font-display text-3xl font-extrabold">{t("me.checkinQr")}</h1>
      {fromDoor ? <EntranceScan /> : null}
      {list.isPending ? (
        <Skeleton className="mt-4 aspect-square w-full rounded-card" />
      ) : !chosen ? (
        <EmptyState className="mt-4" title={t("me.noLinked")} body={t("me.noLinkedBody")} action={<ButtonLink href="/me/requests">{t("me.requests")}</ButtonLink>} />
      ) : (
        <>
          {linked.length > 1 ? (
            <SegmentedControl className="mt-4" label={t("me.chooseGym")} value={chosen.memberId} onChange={(v) => router.replace(`${pathname}?m=${v}`, { scroll: false })} options={linked.map((m) => ({ value: m.memberId, label: m.gym?.name ?? m.memberCode }))} />
          ) : null}
          <Qr key={chosen.memberId} memberId={chosen.memberId} gym={chosen.gym?.name ?? ""} code={chosen.memberCode} />
        </>
      )}
      {fromDoor ? null : <EntranceScan />}
    </section>
  );
}

function Qr({ memberId, gym, code }: { memberId: string; gym: string; code: string }) {
  const t = useTranslations("gm");
  const err = useGymError();
  const box = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState<CheckinToken | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [problem, setProblem] = useState<unknown>(null);
  const [left, setLeft] = useState(0);

  // Fetch a token, then the next one shortly before it expires (one request per window).
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      try {
        const tk = await gymMe.checkinToken(memberId);
        if (!live) return;
        setToken(tk);
        setProblem(null);
        timer = setTimeout(load, qrRefreshIn(tk.expiresAt));
      } catch (e) {
        if (!live) return;
        setProblem(e);
        timer = setTimeout(load, 10_000);
      }
    };
    void load();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [memberId]);

  useEffect(() => {
    if (!token) return;
    let live = true;
    QRCode.toDataURL(token.token, { errorCorrectionLevel: "M", margin: 2, width: 720, color: { dark: "#111210", light: "#ffffff" } }).then((u) => live && setSrc(u));
    const tick = () => setLeft(Math.max(0, Math.round((Date.parse(token.expiresAt) - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [token]);

  const full = () => {
    const el = box.current;
    if (el && document.fullscreenElement !== el) void el.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div ref={box} className="flex flex-col items-center justify-center gap-3 rounded-card bg-white p-4 text-[#111210] [&:fullscreen]:rounded-none" data-testid="me-qr">
        <p className="text-center text-lg font-extrabold">{gym}</p>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={t("me.qrAlt", { gym })} className="aspect-square w-full max-w-[min(80vh,520px)]" data-token-expires={token?.expiresAt} />
        ) : (
          <div className="aspect-square w-full max-w-[520px] kg-shimmer rounded-control bg-neutral-200" />
        )}
        <p className="font-mono text-sm tabular-nums">{code}</p>
        {token ? <p className="text-xs">{t("me.qrRefresh", { s: left })}</p> : null}
      </div>
      {problem ? <Notice tone="error">{err(problem)}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" icon={<ArrowsOut size={18} aria-hidden />} onClick={full} data-testid="qr-full">
          {t("me.fullScreen")}
        </Button>
      </div>
      <p className="flex items-start gap-2 text-sm text-muted">
        <Sun size={18} className="mt-0.5 shrink-0" aria-hidden /> {t("me.brightness")}
      </p>
    </div>
  );
}
