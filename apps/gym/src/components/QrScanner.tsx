"use client";

import { useEffect, useRef, type RefObject } from "react";

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
 * camera plays into `video` and a QR is read every 300 ms; the same value is ignored for 5 s (one
 * scan, one request). `onDenied` runs when the camera can't be opened. The stream stops when `on`
 * turns false or the page leaves.
 */
export function useQrScanner({ on, video, onValue, onDenied }: { on: boolean; video: RefObject<HTMLVideoElement | null>; onValue: (value: string) => void; onDenied: () => void }) {
  const last = useRef<{ value: string; at: number }>({ value: "", at: 0 });
  const handlers = useRef({ onValue, onDenied });
  useEffect(() => {
    handlers.current = { onValue, onDenied };
  }, [onValue, onDenied]);

  useEffect(() => {
    if (!on) return;
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
          const scanned = await detector.detect(video.current).catch(() => []);
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
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [on, video]);
}
