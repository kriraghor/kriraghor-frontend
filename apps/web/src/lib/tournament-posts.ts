import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { dayKey } from "./tournament-dates";

/**
 * The tournament feed (M26, ADR-008): people post about tournaments they run elsewhere; Kriraghor
 * organises nothing and holds no money. Filters live in the URL, so a filtered feed can be shared.
 */
export type PostCard = components["schemas"]["TournamentPostCard"];
export type PostPage = components["schemas"]["TournamentPostPage"];
export type Thread = components["schemas"]["TournamentThread"];
export type PostForm = {
  title: string;
  sport: string;
  format: Format;
  districtId: string;
  areaId: string | null;
  venueName: string;
  address: string | null;
  mapLink: string | null;
  startDate: string;
  endDate: string | null;
  registrationDeadline: string;
  entryFee: number;
  prizePool: number | null;
  prizeDetails: string | null;
  teamLimit: number | null;
  playersPerTeam: number | null;
  gender: Gender;
  ageGroup: string | null;
  skillLevel: Skill | null;
  organiserName: string;
  description: string;
  rules: string | null;
};

export const FORMATS = ["league", "knockout", "group_knockout", "round_robin", "other"] as const;
export const GENDERS = ["open", "men", "women"] as const;
export const SKILLS = ["any", "beginner", "intermediate", "advanced"] as const;
export const SORTS = ["newest", "starts_soon", "deadline_soon", "most_discussed"] as const;
export const FEES = ["free", "paid"] as const;
export type Format = (typeof FORMATS)[number];
export type Gender = (typeof GENDERS)[number];
export type Skill = (typeof SKILLS)[number];
export type Sort = (typeof SORTS)[number];

/** What the URL can say about the feed; "" is no filter. */
export const FEED_FILTERS = {
  q: { default: "" },
  sport: { default: "" },
  districtId: { default: "" },
  fee: { default: "", allowed: ["", ...FEES] },
  format: { default: "", allowed: ["", ...FORMATS] },
  gender: { default: "", allowed: ["", ...GENDERS] },
  open: { default: "", allowed: ["", "1"] },
  sort: { default: "newest", allowed: SORTS },
} as const;
export type FeedFilters = Record<keyof typeof FEED_FILTERS, string>;

/** The feed's URL filters as the API's query. Short searches are left out, because the API refuses them. */
export function feedQuery(f: Partial<FeedFilters>, cursor?: string) {
  const q = (f.q ?? "").trim();
  return {
    ...(q ? { q: q.slice(0, 60) } : {}),
    ...(f.sport ? { sport: f.sport } : {}),
    ...(f.districtId ? { districtId: f.districtId } : {}),
    ...(f.fee ? { fee: f.fee as (typeof FEES)[number] } : {}),
    ...(f.format ? { format: f.format as Format } : {}),
    ...(f.gender ? { gender: f.gender as Gender } : {}),
    ...(f.open ? { registrationOpen: "true" as const } : {}),
    sort: (f.sort || "newest") as Sort,
    ...(cursor ? { cursor } : {}),
  };
}

export const EMPTY_FORM: PostForm = {
  title: "",
  sport: "",
  format: "knockout",
  districtId: "",
  areaId: null,
  venueName: "",
  address: null,
  mapLink: null,
  startDate: "",
  endDate: null,
  registrationDeadline: "",
  entryFee: 0,
  prizePool: null,
  prizeDetails: null,
  teamLimit: null,
  playersPerTeam: null,
  gender: "open",
  ageGroup: null,
  skillLevel: null,
  organiserName: "",
  description: "",
  rules: null,
};

/** A post on its way back into the form, for editing. */
export function formOf(p: PostPage): PostForm {
  return {
    title: p.title,
    sport: p.sport.key,
    format: p.format,
    districtId: p.district?.id ?? "",
    areaId: p.area?.id ?? null,
    venueName: p.venueName,
    address: p.address,
    mapLink: p.mapLink,
    startDate: p.startDate,
    endDate: p.endDate,
    registrationDeadline: p.registrationDeadline,
    entryFee: p.entryFee,
    prizePool: p.prizePool,
    prizeDetails: p.prizeDetails,
    teamLimit: p.teamLimit,
    playersPerTeam: p.playersPerTeam,
    gender: p.gender,
    ageGroup: p.ageGroup,
    skillLevel: p.skillLevel,
    organiserName: p.organiserName,
    description: p.description,
    rules: p.rules,
  };
}

/** Taka as typed in the form, to poisha; empty or not a number is null. */
export function poishaOf(taka: string): number | null {
  const text = taka.trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** Poisha back to what the form shows. */
export const takaOf = (poisha: number | null) => (poisha === null ? "" : String(poisha / 100));

/** What's still missing before the form can be sent; the API checks everything again. */
export function formProblems(f: PostForm, today = dayKey()): (keyof PostForm)[] {
  const out: (keyof PostForm)[] = [];
  if (f.title.trim().length < 5) out.push("title");
  if (!f.sport) out.push("sport");
  if (!f.districtId) out.push("districtId");
  if (f.venueName.trim().length < 2) out.push("venueName");
  if (!f.startDate || f.startDate < today) out.push("startDate");
  if (!f.registrationDeadline || (f.startDate && f.registrationDeadline > f.startDate)) out.push("registrationDeadline");
  if (f.endDate && f.startDate && f.endDate < f.startDate) out.push("endDate");
  if (f.organiserName.trim().length < 2) out.push("organiserName");
  if (f.description.trim().length < 20) out.push("description");
  return out;
}

const ok = async <T>(p: Promise<{ data?: T; error?: unknown }>): Promise<T> => {
  const r = await p;
  if (r.error !== undefined || r.data === undefined) throw r.error ?? new Error("unavailable");
  return r.data;
};
const post = (id: string) => ({ params: { path: { id } } });

export const tournamentPosts = {
  feed: (f: Partial<FeedFilters>, cursor?: string) => ok(api().GET("/tournament-posts", { params: { query: feedQuery(f, cursor) } })),
  page: (slug: string) => ok(api().GET("/tournament-posts/{slug}", { params: { path: { slug } } })),
  create: (body: PostForm) => ok(api().POST("/me/tournament-posts", { body })),
  update: (id: string, body: PostForm) => ok(api().PATCH("/me/tournament-posts/{id}", { ...post(id), body })),
  close: (id: string) => ok(api().POST("/me/tournament-posts/{id}/close", post(id))),
  mine: (cursor?: string) => ok(api().GET("/me/tournament-posts", { params: { query: cursor ? { cursor } : {} } })),
  addPhoto: (id: string, file: File) =>
    ok(
      api().POST("/me/tournament-posts/{id}/photos", {
        ...post(id),
        body: file as unknown as never,
        bodySerializer: (b: unknown) => b as BodyInit,
        headers: { "Content-Type": file.type },
      })
    ),
  removePhoto: (id: string, photoId: string) => ok(api().POST("/me/tournament-posts/{id}/photos/{photoId}/remove", { params: { path: { id, photoId } } })),
  comments: (id: string, cursor?: string) => ok(api().GET("/tournament-posts/{id}/comments", { params: { path: { id }, query: cursor ? { cursor } : {} } })),
  comment: (id: string, body: string) => ok(api().POST("/tournament-posts/{id}/comments", { ...post(id), body: { body } })),
  removeComment: (id: string, commentId: string) => ok(api().POST("/tournament-posts/{id}/comments/{commentId}/remove", { params: { path: { id, commentId } } })),
  openThread: (id: string) => ok(api().POST("/tournament-posts/{id}/threads", post(id))),
  threads: () => ok(api().GET("/me/tournament-threads", {})),
  messages: (id: string) => ok(api().GET("/me/tournament-threads/{id}/messages", { params: { path: { id }, query: {} } })),
  send: (id: string, body: string) => ok(api().POST("/me/tournament-threads/{id}/messages", { ...post(id), body: { body } })),
  markRead: (id: string) => ok(api().POST("/me/tournament-threads/{id}/read", post(id))),
  sports: async () => (await ok(api().GET("/catalog/sports", {}))).items,
  locations: async () => (await ok(api().GET("/catalog/locations", {}))).items,
  areas: async (districtId: string) => (await ok(api().GET("/catalog/areas", { params: { query: { districtId } } }))).items,
};
