"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { clickToPlay, firstStream, type EventStream } from "@/lib/events";
import { Chip } from "./bits";

type Stream = Pick<EventStream, "id" | "platform" | "url" | "title" | "isLive" | "embedUrl">;

/**
 * The stream player (M21-FR-29, M23). It embeds only from the server's embedUrl (built from a parsed
 * video id, never from a stored URL), in a sandboxed iframe that sends only our origin as the
 * referrer (YouTube needs one). Facebook waits for a click (its player loads Facebook tracking).
 * Links that cannot embed (TikTok live, unknown link forms) are buttons that open the platform.
 */
export function StreamPlayer({ streams, testId = "stream-player" }: { streams: Stream[]; testId?: string }) {
  const t = useTranslations("esports.events");
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  if (!streams.length) return null;
  const embeddable = streams.filter((s) => s.embedUrl);
  const current = embeddable.find((s) => s.id === chosenId) ?? firstStream(streams as EventStream[]);
  const links = streams.filter((s) => !s.embedUrl);
  const waiting = current && clickToPlay(current) && armed !== current.id;
  return (
    <div data-testid={testId}>
      {current ? (
        <div className="relative aspect-video w-full overflow-hidden border-2 border-line-strong bg-black">
          {waiting ? (
            <button type="button" onClick={() => setArmed(current.id)} className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white" data-testid="stream-click-to-play">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 text-3xl" aria-hidden>
                ▶
              </span>
              <span className="font-bold">{t("player.play", { title: current.title })}</span>
              <span className="max-w-[46ch] px-6 text-center text-xs text-white/70">{t("player.facebookNote")}</span>
            </button>
          ) : (
            <iframe
              key={current.id}
              src={current.embedUrl ?? undefined}
              title={current.title}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              // YouTube refuses embeds without a Referer (error 153); send only our origin.
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
              loading="lazy"
              data-testid="stream-iframe"
            />
          )}
        </div>
      ) : null}
      {embeddable.length > 1 || links.length ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={t("player.choose")}>
          {embeddable.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setChosenId(s.id)}
                aria-pressed={current?.id === s.id}
                className={`inline-flex min-h-11 items-center gap-2 border-2 px-4 text-sm font-semibold ${current?.id === s.id ? "border-brand" : "border-line hover:border-line-strong"}`}
              >
                {s.isLive ? <Chip tone="live">{t("live")}</Chip> : null}
                {s.title}
              </button>
            </li>
          ))}
          {links.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 border-2 border-line px-4 text-sm font-semibold hover:border-line-strong">
                {s.isLive ? <Chip tone="live">{t("live")}</Chip> : null}
                {s.title} <span aria-hidden>↗</span>
                <span className="sr-only">{t("player.opensElsewhere", { platform: s.platform })}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
