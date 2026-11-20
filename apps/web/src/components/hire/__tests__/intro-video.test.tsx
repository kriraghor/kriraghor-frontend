import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../../messages/en.json";
import { IntroVideo } from "../IntroVideo";
import type { IntroVideo as Video } from "@/lib/hire";

// M11-FR-16: nothing loads from the video's host until Play; then the right player for the link.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  // jsdom has no media playback.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

const mount = (video: Video) =>
  act(() =>
    root.render(
      <NextIntlClientProvider locale="en" messages={en}>
        <IntroVideo video={video} title="Intro video: Nusrat Jahan" />
      </NextIntlClientProvider>,
    ),
  );
const play = () => act(() => host.querySelector<HTMLButtonElement>('[data-testid="intro-video-play"]')!.click());

const yt: Video = { url: "https://youtu.be/dQw4w9WgXcQ", provider: "youtube", kind: "iframe", playUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" };

describe("IntroVideo", () => {
  it("shows only a play button until pressed, then a sandboxed iframe that autoplays", () => {
    mount(yt);
    expect(host.querySelector("iframe")).toBeNull();
    expect(host.textContent).toContain("Plays from YouTube");
    expect(host.querySelector("a")!.getAttribute("href")).toBe(yt.url);
    play();
    const frame = host.querySelector("iframe")!;
    expect(frame.getAttribute("src")).toBe(`${yt.playUrl}?autoplay=1`);
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin allow-presentation allow-popups");
    expect(frame.getAttribute("title")).toBe("Intro video: Nusrat Jahan");
  });

  it("Drive plays its preview as given (no autoplay parameter)", () => {
    const drive: Video = { url: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view", provider: "google_drive", kind: "iframe", playUrl: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview" };
    mount(drive);
    play();
    expect(host.querySelector("iframe")!.getAttribute("src")).toBe(drive.playUrl);
  });

  it("a file plays in <video>, and a failure offers the original link", () => {
    const file: Video = { url: "https://www.dropbox.com/scl/fi/abc/intro.mp4?dl=0", provider: "dropbox", kind: "file", playUrl: "https://www.dropbox.com/scl/fi/abc/intro.mp4?raw=1" };
    mount(file);
    play();
    const video = host.querySelector("video")!;
    expect(video.getAttribute("src") ?? video.src).toBe(file.playUrl);
    act(() => {
      video.dispatchEvent(new Event("error"));
    });
    expect(host.querySelector('[role="alert"]')!.textContent).toContain("cannot play here");
    expect(host.querySelector("a")!.textContent).toContain("Open on Dropbox");
  });

  it("HLS plays natively where the browser can (Safari)", () => {
    vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("maybe");
    const hls: Video = { url: "https://media.example.org/a/index.m3u8", provider: "hls", kind: "hls", playUrl: "https://media.example.org/a/index.m3u8" };
    mount(hls);
    play();
    expect(host.querySelector("video")!.src).toBe(hls.playUrl);
  });
});
