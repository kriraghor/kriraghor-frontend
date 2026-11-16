"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { ArrowsOut } from "@phosphor-icons/react";
import { Button, Notice } from "@kriraghor/ui/kit";
import { gymManage, qrRefreshIn, type EntranceToken } from "@/lib/gym-manage";
import { entranceLink } from "@/lib/plans";
import { GymPage, useFmt, useGymError, type GymCtx } from "./common";

type WakeLock = { release: () => Promise<void> };

/**
 * /manage/[gymId]/entrance (M24-FR-51, attendance.mark, Basic tier and up): the entrance QR for a
 * tablet at the door. The token changes every gym_manage.entrance_qr_seconds and is signed like the
 * M20 pass token (no personal data); members may still scan the previous one for one more window.
 * The QR is a link to gym.kriraghor.com/me/checkin?e=…, so a member's phone camera opens it and
 * checks in. The page fetches the next token shortly before this one ends, shows the gym name and a
 * clock, goes full screen on a tap and keeps the screen awake while open.
 */
export function Entrance({ gymId }: { gymId: string }) {
  const t = useTranslations("gp.entrance");
  return (
    <GymPage gymId={gymId} page="entrance" feature="attendance" title={t("deskTitle")} description={t("deskLead")} testId="gm-entrance">
      {(ctx) => <Board ctx={ctx} />}
    </GymPage>
  );
}

function Board({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gp.entrance");
  const f = useFmt();
  const err = useGymError();
  const box = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState<EntranceToken | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [problem, setProblem] = useState<unknown>(null);
  const [now, setNow] = useState(() => Date.now());

  // One request per window: the next token a few seconds before this one ends; after an error, again in 10 s.
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      try {
        const tk = await gymManage.entranceToken(ctx.gymId);
        if (!live) return;
        setToken(tk);
        setProblem(null);
        timer = setTimeout(load, qrRefreshIn(tk.expiresAt, Date.now(), Math.min(5000, tk.seconds * 200)));
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
  }, [ctx.gymId]);

  useEffect(() => {
    if (!token) return;
    let live = true;
    QRCode.toDataURL(entranceLink(window.location.origin, token.token), { errorCorrectionLevel: "M", margin: 2, width: 900, color: { dark: "#111210", light: "#ffffff" } }).then((u) => live && setSrc(u));
    return () => {
      live = false;
    };
  }, [token]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Keep the tablet's screen on while the page is open (where the browser allows it).
  useEffect(() => {
    let lock: WakeLock | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLock> } };
    const take = () => void nav.wakeLock?.request("screen").then((l) => (lock = l), () => undefined);
    take();
    const again = () => document.visibilityState === "visible" && take();
    document.addEventListener("visibilitychange", again);
    return () => {
      document.removeEventListener("visibilitychange", again);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  const full = () => {
    const el = box.current;
    if (el && document.fullscreenElement !== el) void el.requestFullscreen?.().catch(() => undefined);
  };
  const left = token ? Math.max(0, Math.round((Date.parse(token.expiresAt) - now) / 1000)) : 0;
  const clock = f.time(new Date(now).toISOString());

  return (
    <div className="flex flex-col gap-3">
      <div ref={box} className="flex flex-col items-center justify-center gap-4 rounded-card bg-white p-6 text-[#111210] [&:fullscreen]:rounded-none" data-testid="entrance-board">
        <p className="text-center font-display text-3xl font-extrabold md:text-4xl">{token?.gymName ?? ctx.gym.name}</p>
        <p className="text-center text-lg font-semibold">{t("boardLead")}</p>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={t("qrAlt")} className="aspect-square w-full max-w-[min(70vh,640px)]" data-testid="entrance-qr" data-token-expires={token?.expiresAt} />
        ) : (
          <div className="aspect-square w-full max-w-[640px] kg-shimmer rounded-control bg-neutral-200" />
        )}
        <p className="font-mono text-4xl font-bold tabular-nums" aria-live="off">
          {clock}
        </p>
        {token ? <p className="text-sm tabular-nums">{t("changesIn", { s: left })}</p> : null}
      </div>
      {problem ? <Notice tone="error">{err(problem)}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" icon={<ArrowsOut size={18} aria-hidden />} onClick={full} data-testid="entrance-full">
          {t("fullScreen")}
        </Button>
      </div>
      <p className="text-sm text-muted">{t("deskHint")}</p>
    </div>
  );
}
