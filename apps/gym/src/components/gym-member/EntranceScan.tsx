"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Camera, CheckCircle, DoorOpen } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";
import { Button, Card, Notice } from "@kriraghor/ui/kit";
import { gymMe, type EntranceCheckin, type EntranceCheckout } from "@/lib/gym-manage";
import { useDuration } from "@/components/gym-ops/DeskFeed";
import { entranceTokenFrom } from "@/lib/plans";
import { canScan, useQrScanner } from "@/components/QrScanner";
import { useFmt, useGymError } from "@/components/gym-manage/common";

type Result = { ok: true; c: EntranceCheckin } | { ok: true; out: EntranceCheckout } | { ok: false; message: string };

/**
 * The entrance self check-in on /me/checkin (M24-FR-51): the gym's tablet at the door shows a QR that
 * changes every gym_manage.entrance_qr_seconds. The QR is a link (lib/plans entranceLink), so any
 * phone camera opens this page with ?e=<token> and the check-in goes in at once; where the browser can
 * read QR codes (Chrome on Android) **Scan the entrance QR** reads it here. One counted check-in per
 * Dhaka day; the gym's entry rule may add a warning (no amounts are shown).
 */
export function EntranceScan() {
  const t = useTranslations("gp.entrance");
  const tg = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const dur = useDuration();
  const tgo = useTranslations("go");
  const qc = useQueryClient();
  const { status } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [camera, setCamera] = useState<"off" | "on" | "denied" | "unsupported">("off");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const sent = useRef<string | null>(null);

  const submit = useCallback(
    async (raw: string) => {
      const token = entranceTokenFrom(raw);
      if (!token) return setResult({ ok: false, message: t("notEntrance") });
      if (sent.current === token) return;
      sent.current = token;
      setBusy(true);
      try {
        const r = await gymMe.entranceCheckin(token);
        // M27-FR-41: a second scan after the minimum visit is a check-out.
        setResult(r.checkedOut === true ? { ok: true, out: r } : { ok: true, c: r as EntranceCheckin });
        setCamera("off");
        void qc.invalidateQueries({ queryKey: ["my-gym-memberships"] });
      } catch (e) {
        const code = problemOf(e)?.code;
        setResult({ ok: false, message: code && t.has(`err.${code}`) ? t(`err.${code}`) : err(e) });
        sent.current = null;
      } finally {
        setBusy(false);
      }
    },
    [err, qc, t],
  );

  // Opened from the tablet's QR with the phone's own camera: check in once, then drop ?e= from the URL.
  const linked = params.get("e");
  useEffect(() => {
    if (!linked || status !== "signed_in") return;
    // After the effect, not inside it (no state update in the effect body); `sent` drops a repeat.
    void Promise.resolve().then(() => submit(linked));
    const q = new URLSearchParams(params.toString());
    q.delete("e");
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }, [linked, status, params, pathname, router, submit]);

  const onValue = useCallback((v: string) => void submit(v), [submit]);
  const onDenied = useCallback(() => setCamera("denied"), []);
  const video = useQrScanner({ on: camera === "on", onValue, onDenied });

  return (
    <Card className="mt-6 flex flex-col gap-3" data-testid="entrance-scan">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <DoorOpen size={22} aria-hidden /> {t("title")}
      </h2>
      <p className="text-sm text-muted">{t("lead")}</p>
      {result?.ok && "out" in result ? (
        <Notice tone="info" title={tgo("desk.byeTitle", { gym: result.out.gym?.name ?? "" })}>
          <span data-testid="entrance-result">
            {tgo("desk.byeBody", { time: f.time(result.out.checkedOutAt) })}
            {result.out.visitMinutes != null ? ` · ${dur(result.out.visitMinutes)}` : ""}
          </span>
        </Notice>
      ) : result?.ok ? (
        <Notice tone={result.c.decision === "warn" ? "warning" : "success"} title={result.c.counted ? t("in", { gym: result.c.gym?.name ?? "" }) : t("already", { time: f.time(result.c.firstCheckInToday) })}>
          <span className="flex flex-col gap-1" data-testid="entrance-result">
            <span>{t("at", { time: f.time(result.c.checkedInAt), code: result.c.member.memberCode })}</span>
            {result.c.membership ? <span>{t("package", { title: result.c.membership.title, n: result.c.membership.daysLeft })}</span> : null}
            {result.c.decision === "warn" && result.c.reasons.length ? <span>{t("warn", { reasons: result.c.reasons.map((r) => tg(`reason.${r}`)).join(", ") })}</span> : null}
          </span>
        </Notice>
      ) : result ? (
        <Notice tone="error">{result.message}</Notice>
      ) : null}
      {camera === "on" ? (
        <>
          <video ref={video} muted playsInline className="aspect-square w-full max-w-[420px] rounded-control bg-black object-cover" />
          <Button type="button" variant="secondary" onClick={() => setCamera("off")}>
            {t("stop")}
          </Button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Button type="button" size="lg" icon={result?.ok ? <CheckCircle size={20} aria-hidden /> : <Camera size={20} aria-hidden />} busy={busy} onClick={() => setCamera(canScan() ? "on" : "unsupported")} data-testid="entrance-camera">
            {result?.ok ? t("scanAgain") : t("scan")}
          </Button>
          {camera === "unsupported" ? <p className="text-sm text-muted">{t("useCameraApp")}</p> : null}
          {camera === "denied" ? <p className="text-sm text-danger">{t("cameraDenied")}</p> : null}
        </div>
      )}
    </Card>
  );
}
