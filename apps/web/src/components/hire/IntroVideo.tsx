"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowSquareOut, Play } from "@phosphor-icons/react";
import type { IntroVideo as Video } from "@/lib/hire";

/**
 * The player address: start at once (the visitor pressed play), and keep the host's own extras to the least
 * its player allows (tester feedback, 28 Nov 2026): YouTube without related videos or annotations, Vimeo
 * without its title, byline and portrait. The host's small logo stays inside its player (its terms).
 */
export function playerUrl(v: Video): string {
  const extra =
    v.provider === "youtube"
      ? "autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1"
      : v.provider === "vimeo"
        ? "autoplay=1&title=0&byline=0&portrait=0&dnt=1"
        : "";
  return extra ? `${v.playUrl}${v.playUrl.includes("?") ? "&" : "?"}${extra}` : v.playUrl;
}

/**
 * M11-FR-16: a hire profile's intro video, given as a link and never uploaded to Kriraghor. Nothing is
 * loaded from the video's host until the visitor presses play (no tracking on page view). Then:
 * - YouTube (no-cookie), Vimeo, Facebook, Google Drive and OneDrive play in a sandboxed iframe;
 * - Dropbox and direct .mp4/.webm/.m4v files in <video>;
 * - .m3u8 playlists natively (Safari) or with hls.js, loaded only then.
 * If it cannot play, the link opens where the video lives.
 * Tester feedback, 28 Nov 2026: our frame names no platform ("Plays from YouTube" and "Open on YouTube" are
 * gone); the link to the original shows only when the video cannot play here.
 */
export function IntroVideo({ video, title, testId = "intro-video" }: { video: Video; title: string; testId?: string }) {
  const t = useTranslations("hire.video");
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => setFailed(true), []);

  return (
    <figure className="mt-6 max-w-2xl" data-testid={testId}>
      <div className="relative aspect-video overflow-hidden rounded-card border border-line bg-neutral-950">
        {!playing ? (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3 text-white transition-colors hover:bg-white/5 focus-visible:outline-offset-[-4px]"
            aria-label={t("play", { title })}
            data-testid={`${testId}-play`}
          >
            <span className="flex size-16 items-center justify-center rounded-pill bg-brand text-on-brand shadow-lg transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
              <Play size={30} weight="fill" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-white/85">{t("watch")}</span>
          </button>
        ) : failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white" role="alert">
            <p className="font-semibold">{t("cannotPlay")}</p>
            <a href={video.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-white underline underline-offset-4">
              <ArrowSquareOut size={16} aria-hidden />
              {t("openVideo")}
            </a>
          </div>
        ) : video.kind === "iframe" ? (
          <iframe
            src={playerUrl(video)}
            title={title}
            className="absolute inset-0 size-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <FilePlayer video={video} title={title} onFail={fail} />
        )}
      </div>
    </figure>
  );
}

/** <video> for files, with HLS through the browser or hls.js. */
function FilePlayer({ video, title, onFail }: { video: Video; title: string; onFail: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (video.kind !== "hls" || el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = video.playUrl;
      void el.play().catch(() => undefined);
      return;
    }
    let destroy: (() => void) | undefined;
    let cancelled = false;
    void import("hls.js").then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) return onFail();
      const hls = new Hls({ enableWorker: true });
      hls.on(Hls.Events.ERROR, (_e, data) => data.fatal && onFail());
      hls.loadSource(video.playUrl);
      hls.attachMedia(el);
      hls.on(Hls.Events.MANIFEST_PARSED, () => void el.play().catch(() => undefined));
      destroy = () => hls.destroy();
    }, onFail);
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [video, onFail]);
  return <video ref={ref} title={title} controls playsInline preload="metadata" className="absolute inset-0 size-full bg-black" onError={onFail} />;
}
