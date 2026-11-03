import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import bn from "../../../messages/bn.json";
import { adminSections } from "../panel-nav";
import { POST_STATUSES, postActions } from "../admin/tournament-posts";

describe("the Tournament posts desk (M26-FR-09)", () => {
  it("removes what is on show and restores what was removed", () => {
    expect(postActions("open")).toEqual(["remove"]);
    expect(postActions("closed")).toEqual(["remove"]);
    expect(postActions("expired")).toEqual(["remove"]);
    expect(postActions("removed")).toEqual(["restore"]);
  });

  it("names every status in both languages", () => {
    for (const s of POST_STATUSES) {
      expect(en.tournamentPosts.status[s]).toBeTruthy();
      expect(bn.tournamentPosts.status[s]).toBeTruthy();
    }
  });

  it("shows in the admin menu for approve_listings only", () => {
    const hrefs = (p: string[]) => adminSections({ isMaster: false, permissions: p }).flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs(["approve_listings"])).toContain("/admin/tournament-posts");
    expect(hrefs(["view_payouts"])).not.toContain("/admin/tournament-posts");
  });

  it("the Reports desk names the feed's subjects", () => {
    for (const m of [en, bn]) {
      expect(m.reportsDesk.subject.tournament_post).toBeTruthy();
      expect(m.reportsDesk.subject.tournament_comment).toBeTruthy();
    }
  });
});
