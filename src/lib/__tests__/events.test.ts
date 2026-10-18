import { describe, expect, it } from "vitest";
import { byFinal, clickToPlay, firstStream, jitter, type EventStream, type Qualification } from "../events";

const s = (o: Partial<EventStream>): EventStream => ({ id: "x", source: "event", tournamentId: null, platform: "youtube", url: "https://youtu.be/x", title: "T", isLive: false, embedUrl: null, ...o });

describe("big events (M23)", () => {
  it("opens the player on a live stream that embeds, else any that embeds", () => {
    const tiktok = s({ id: "tt", platform: "tiktok", isLive: true });
    const yt = s({ id: "yt", embedUrl: "https://www.youtube-nocookie.com/embed/x" });
    const fb = s({ id: "fb", platform: "facebook", isLive: true, embedUrl: "https://www.facebook.com/plugins/video.php?href=x" });
    expect(firstStream([tiktok, yt, fb])?.id).toBe("fb");
    expect(firstStream([tiktok, yt])?.id).toBe("yt");
    expect(firstStream([tiktok])).toBeNull();
    expect(clickToPlay(fb)).toBe(true);
    expect(clickToPlay(yt)).toBe(false);
  });

  it("spreads re-fetches over a short random delay", () => {
    expect(jitter(1500, () => 0)).toBe(0);
    expect(jitter(1500, () => 0.999)).toBe(1498);
  });

  it("groups places under their final, best rank first, invites last", () => {
    const q = (id: string, finalTournamentId: string, rank: number | null): Qualification => ({ id, finalTournamentId, sourceTournamentId: null, rank, status: "qualified", entry: { kind: "player", id, name: id, tag: null }, createdAt: "2026-11-10T00:00:00Z" });
    const g = byFinal([q("c", "f1", null), q("b", "f1", 2), q("a", "f1", 1), q("z", "f2", 1)]);
    expect(g.get("f1")!.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(g.get("f2")!.map((x) => x.id)).toEqual(["z"]);
  });
});
