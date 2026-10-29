"use client";

import { useEffect, useRef } from "react";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

/** The browser's QR reader (Chrome on Android and desktop); absent elsewhere (iOS Safari), so a typed or linked fallback is always there. */
export function makeDetector(): Detector | null {
  const D = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  return D ? new D({ formats: ["qr_code"] }) : null;
}

/** Can this browser scan a QR with the camera here? */
export const canScan = () => makeDetector() !== null && typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";

/**
 * The camera loop shared by the front desk and the member's entrance scan: while `on`, the back
 * camera plays into the returned video ref (put it on the <video> element) and a QR is read every
 * 300 ms; the same value is ignored for 5 s (one scan, one request). `onDenied` runs when the camera
 * can't be opened. The stream stops when `on` turns false or the page leaves. The hook owns the ref,
 * so the effect may set the element's stream (the React compiler refuses mutating a caller's value).
 */
export function useQrScanner({ on, onValue, onDenied }: { on: boolean; onValue: (value: string) => void; onDenied: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const last = useRef<{ value: string; at: number }>({ value: "", at: 0 });
  const handlers = useRef({ onValue, onDenied });
  useEffect(() => {
    handlers.current = { onValue, onDenied };
  }, [onValue, onDenied]);

  useEffect(() => {
    if (!on) return;
    const detector = makeDetector();
    // One mutable holder for the loop, so cleanup sees what the async start produced.
    const run: { stream: MediaStream | null; timer: ReturnType<typeof setInterval> | null; stopped: boolean } = { stream: null, timer: null, stopped: false };
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        run.stream = stream;
        const el = video.current;
        if (run.stopped || !el) return;
        el.srcObject = stream;
        await el.play();
        run.timer = setInterval(async () => {
          const cur = video.current;
          if (!cur || !detector) return;
          const scanned = await detector.detect(cur).catch(() => []);
          const value = scanned[0]?.rawValue;
          if (!value) return;
          const now = Date.now();
          if (value === last.current.value && now - last.current.at < 5000) return;
          last.current = { value, at: now };
          handlers.current.onValue(value);
        }, 300);
      } catch {
        handlers.current.onDenied();
      }
    };
    void start();
    return () => {
      run.stopped = true;
      if (run.timer) clearInterval(run.timer);
      run.stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [on]);

  return video;
}
