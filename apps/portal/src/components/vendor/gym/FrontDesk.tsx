"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { cleanCode, gymDesk, scanInput, type Admission } from "@/lib/vendor/gym";
import { Notice } from "@kriraghor/ui/primitives";
import { inputCls } from "../../admin/finance/shared";

type Result = { ok: true; a: Admission } | { ok: false; code: string; title: string; at?: string; validFrom?: string; validTo?: string };
type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

/** The browser's QR reader (Chrome on Android and desktop); absent elsewhere, so the code entry is always there. */
function makeDetector(): Detector | null {
  const D = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  return D ? new D({ formats: ["qr_code"] }) : null;
}

/**
 * /vendor/gyms/[id]/desk (M20 §5): the front desk. Scan the member's QR (camera, where the browser can
 * read QR codes) or type the 6-character backup code. The server decides: the right gym, valid today,
 * open now, not used today. The result card shows who it is and the pass; today's admissions follow.
 */
export function FrontDesk({ id }: { id: string }) {
  const t = useTranslations("vendorGym");
  const locale = useLocale();
  const qc = useQueryClient();
  const gym = useQuery({ queryKey: ["vendor-gym", id], queryFn: () => gymDesk.get(id) });
  const today = useQuery({ queryKey: ["gym-admissions", id], queryFn: () => gymDesk.admissions(id), refetchInterval: 30_000 });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [camera, setCamera] = useState<"off" | "on" | "unsupported" | "denied">("off");
  const video = useRef<HTMLVideoElement>(null);
  const lastScan = useRef<{ value: string; at: number }>({ value: "", at: 0 });
  const time = (iso?: string) => (iso ? new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(iso)) : "");
  const day = (d?: string) => (d ? new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`)) : "");

  const admit = useCallback(
    async (input: { token: string } | { code: string }) => {
      setBusy(true);
      try {
        const a = await gymDesk.redeem(id, input);
        setResult({ ok: true, a });
        setCode("");
        await qc.invalidateQueries({ queryKey: ["gym-admissions", id] });
      } catch (err) {
        // The API spreads the problem meta on the body: `at` (the earlier admission), validFrom and validTo.
        const p = problemOf(err) as (ReturnType<typeof problemOf> & { at?: string; validFrom?: string; validTo?: string }) | null;
        setResult({ ok: false, code: p?.code ?? "UNKNOWN", title: p?.title ?? t("failed"), at: p?.at, validFrom: p?.validFrom, validTo: p?.validTo });
      } finally {
        setBusy(false);
      }
    },
    [id, qc, t]
  );

  // The camera loop: read a QR every 300 ms; the same value is ignored for 5 s (one scan, one request).
  useEffect(() => {
    if (camera !== "on") return;
    const detector = makeDetector();
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        timer = setInterval(async () => {
          if (!video.current || !detector) return;
          const found = await detector.detect(video.current).catch(() => []);
          const value = found[0]?.rawValue;
          if (!value) return;
          const now = Date.now();
          if (value === lastScan.current.value && now - lastScan.current.at < 5000) return;
          lastScan.current = { value, at: now };
          void admit(scanInput(value));
        }, 300);
      } catch {
        setCamera("denied");
      }
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [camera, admit]);

  const startCamera = () => setCamera(makeDetector() && typeof navigator.mediaDevices?.getUserMedia === "function" ? "on" : "unsupported");
  const ready = cleanCode(code).length === 6;

  return (
    <section className="mx-auto max-w-[1100px] px-5 py-8">
      <Link href={`/vendor/gyms/${id}`} className="text-sm font-semibold text-brand underline">
        ← {gym.data?.name ?? t("title")}
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold">{t("desk.title")}</h1>
      <p className="mt-1 max-w-2xl text-muted">{t("desk.lead")}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <form
            className="border-2 border-line bg-surface p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready) void admit({ code: cleanCode(code) });
            }}
            data-testid="desk-code-form"
          >
            <label htmlFor="desk-code" className="text-sm font-semibold text-muted">
              {t("desk.codeLabel")}
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="desk-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={9}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className={`${inputCls} flex-1 font-mono text-2xl tracking-[0.3em]`}
                data-testid="desk-code"
              />
              <button type="submit" disabled={!ready || busy} className="min-h-12 bg-brand px-5 font-bold text-white disabled:opacity-50" data-testid="desk-admit">
                {t("desk.admit")}
              </button>
            </div>
          </form>
          <div className="border-2 border-line bg-surface p-5">
            {camera === "on" ? (
              <>
                <video ref={video} muted playsInline className="aspect-video w-full bg-black object-cover" />
                <button type="button" onClick={() => setCamera("off")} className="mt-3 min-h-11 border-2 border-line px-4 font-bold">
                  {t("desk.stopCamera")}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={startCamera} className="min-h-12 border-2 border-brand px-5 font-bold" data-testid="desk-camera">
                  {t("desk.scan")}
                </button>
                {camera === "unsupported" ? <p className="mt-2 text-sm text-muted">{t("desk.noCamera")}</p> : null}
                {camera === "denied" ? <p className="mt-2 text-sm text-danger">{t("desk.cameraDenied")}</p> : null}
              </>
            )}
          </div>
        </div>

        <div aria-live="polite" data-testid="desk-result">
          {result?.ok ? (
            <div className="border-4 border-brand bg-brand/10 p-6" data-testid="desk-admitted">
              <p className="text-sm font-bold uppercase tracking-wide text-brand">{t("desk.admitted")}</p>
              <p className="mt-2 text-3xl font-extrabold">{result.a.holder.displayName ?? t("desk.member")}</p>
              <p className="mt-1 font-semibold">
                {t(`kind.${result.a.kind}`)} · {result.a.passCode}
              </p>
              <p className="text-sm text-muted">{result.a.validFrom === result.a.validTo ? day(result.a.validFrom) : `${day(result.a.validFrom)} – ${day(result.a.validTo)}`}</p>
              <p className="mt-2 text-sm text-muted">{t("desk.at", { time: time(result.a.redeemedAt) })}</p>
            </div>
          ) : result ? (
            <div className="border-4 border-danger p-6" role="alert" data-testid="desk-refused">
              <p className="text-sm font-bold uppercase tracking-wide text-danger">{t("desk.refused")}</p>
              <p className="mt-2 text-2xl font-extrabold">
                {result.code === "PASS_ALREADY_REDEEMED" && result.at
                  ? t("desk.usedAt", { time: time(result.at) })
                  : result.code === "PASS_NOT_VALID_TODAY" && result.validFrom
                    ? t("desk.validOn", { from: day(result.validFrom), to: day(result.validTo) })
                    : t.has(`desk.err.${result.code}`)
                      ? t(`desk.err.${result.code}`)
                      : result.title}
              </p>
            </div>
          ) : (
            <p className="border-2 border-dashed border-line p-8 text-center text-muted">{t("desk.waiting")}</p>
          )}
        </div>
      </div>

      <h2 className="mt-10 text-2xl font-extrabold">{t("desk.today", { n: today.data?.items.length ?? 0 })}</h2>
      {today.isError ? <Notice tone="error">{problemOf(today.error)?.title ?? t("failed")}</Notice> : null}
      {today.data && !today.data.items.length ? <p className="mt-3 text-muted">{t("desk.noneToday")}</p> : null}
      <ul className="mt-3 divide-y-2 divide-line border-y-2 border-line" data-testid="desk-today">
        {(today.data?.items ?? []).map((a) => (
          <li key={`${a.passCode}-${a.redeemedAt}`} className="flex flex-wrap items-center gap-3 py-2">
            <span className="w-16 font-bold tabular-nums">{time(a.redeemedAt)}</span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{a.holder ?? t("desk.member")}</span>
              <span className="text-sm text-muted">
                {" "}
                · {t(`kind.${a.kind}`)} · {a.passCode}
              </span>
            </span>
            <span className="text-xs font-bold uppercase text-muted">{t(`desk.method.${a.method}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
