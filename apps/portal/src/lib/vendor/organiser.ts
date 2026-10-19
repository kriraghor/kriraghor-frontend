import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import type { DeskClient } from "@/components/admin/esports/EsportsDesk";
import type { ResultRow, TournamentInput } from "../admin/esports";
import { unwrap } from "../admin/finance";

/**
 * M22 organiser console client (vendor.kriraghor.com/vendor/esports, the customer session). Every
 * call is scoped to /org/{orgId}: the API answers 404 to anyone who is not a member (M22-FR-03).
 *  - orgDesk(orgId) is the DeskClient the shared tournament parts (create form, check-in board,
 *    matches, rooms, results, finalise preview) use, without the staff-only actions;
 *  - organiser holds the console's own calls: dashboard, fund, submit, finalise with a phone code,
 *    billing, branding, members.
 */
export type Organisation = components["schemas"]["Organisation"];
export type Dashboard = components["schemas"]["OrganiserDashboard"];
export type Contract = components["schemas"]["OrganiserContract"];
export type Invoice = components["schemas"]["OrganiserInvoice"];
export type Branding = components["schemas"]["OrganisationBranding"];
export type Fund = { id: string | null; required: number; deposited: number; toDeposit: number; status: string; block: string | null; paid: number; returned: number };
export type OrgTournament = components["schemas"]["EsportsTournament"] & { fund: Fund; saas: { model: string; feeBps: number | null; contractId: string | null } };

const o = (orgId: string) => ({ orgId });
const ot = (orgId: string, id: string) => ({ path: { orgId, id } });
const om = (orgId: string, matchId: string) => ({ path: { orgId, matchId } });

export function orgDesk(orgId: string): DeskClient {
  return {
    catalog: async () => unwrap(await api().GET("/esports/games")),
    create: async (body: TournamentInput) => unwrap(await api().POST("/org/{orgId}/esports/tournaments", { params: { path: o(orgId) }, body })),
    board: async (id: string) => unwrap(await api().GET("/org/{orgId}/esports/tournaments/{id}/checkins", { params: ot(orgId, id) })),
    preview: async (id: string) => unwrap(await api().GET("/org/{orgId}/esports/tournaments/{id}/finalise-preview", { params: ot(orgId, id) })),
    match: async (mid: string) => unwrap(await api().GET("/org/{orgId}/esports/matches/{matchId}", { params: om(orgId, mid) })),
    room: async (mid: string) => unwrap(await api().GET("/org/{orgId}/esports/matches/{matchId}/room", { params: om(orgId, mid) })),
    setRoom: async (mid: string, body: { roomId: string; password: string }) => unwrap(await api().PUT("/org/{orgId}/esports/matches/{matchId}/room", { params: om(orgId, mid), body })),
    rotate: async (mid: string, body: { roomId: string; password: string; reason?: string }) => unwrap(await api().POST("/org/{orgId}/esports/matches/{matchId}/room/rotate", { params: om(orgId, mid), body })),
    enter: async (mid: string, rows: ResultRow[]) => unwrap(await api().PUT("/org/{orgId}/esports/matches/{matchId}/results", { params: om(orgId, mid), body: { rows } })),
    post: async (mid: string) => unwrap(await api().POST("/org/{orgId}/esports/matches/{matchId}/results/post", { params: om(orgId, mid) })),
  } as DeskClient;
}

const key = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const organiser = {
  mine: async () => unwrap(await api().GET("/me/organisations")),
  dashboard: async (orgId: string) => unwrap(await api().GET("/org/{orgId}/esports/dashboard", { params: { path: o(orgId) } })),
  tournaments: async (orgId: string) => unwrap(await api().GET("/org/{orgId}/esports/tournaments", { params: { path: o(orgId), query: {} } })),
  tournament: async (orgId: string, id: string) => unwrap(await api().GET("/org/{orgId}/esports/tournaments/{id}", { params: ot(orgId, id) })) as unknown as OrgTournament,
  fund: async (orgId: string, id: string) => unwrap(await api().POST("/org/{orgId}/esports/tournaments/{id}/prize-fund", { params: { ...ot(orgId, id), header: { "idempotency-key": key() } } })),
  submit: async (orgId: string, id: string) => unwrap(await api().POST("/org/{orgId}/esports/tournaments/{id}/submit", { params: ot(orgId, id) })),
  cancel: async (orgId: string, id: string, reason: string) => unwrap(await api().POST("/org/{orgId}/esports/tournaments/{id}/cancel", { params: ot(orgId, id), body: { reason } })),
  finaliseCode: async (orgId: string, id: string) => unwrap(await api().POST("/org/{orgId}/esports/tournaments/{id}/finalise/code", { params: ot(orgId, id) })),
  finalise: async (orgId: string, id: string, code: string) => unwrap(await api().POST("/org/{orgId}/esports/tournaments/{id}/finalise", { params: ot(orgId, id), body: { code } })),
  contracts: async (orgId: string) => unwrap(await api().GET("/org/{orgId}/billing/contracts", { params: { path: o(orgId) } })),
  invoices: async (orgId: string) => unwrap(await api().GET("/org/{orgId}/billing/invoices", { params: { path: o(orgId) } })),
  payInvoice: async (orgId: string, id: string) => unwrap(await api().POST("/org/{orgId}/billing/invoices/{id}/pay", { params: { ...ot(orgId, id), header: { "idempotency-key": key() } } })),
  branding: async (orgId: string) => unwrap(await api().GET("/org/{orgId}/branding", { params: { path: o(orgId) } })),
  saveBranding: async (orgId: string, body: { primaryHex: string; accentHex: string; taglineEn?: string | null; taglineBn?: string | null }) => unwrap(await api().PUT("/org/{orgId}/branding", { params: { path: o(orgId) }, body })),
  claimSubdomain: async (orgId: string, subdomain: string) => unwrap(await api().PUT("/org/{orgId}/branding/subdomain", { params: { path: o(orgId) }, body: { subdomain } })),
  uploadLogo: async (orgId: string, file: File) =>
    unwrap(
      await api().POST("/org/{orgId}/branding/logo", {
        params: { path: o(orgId) },
        body: file as unknown as string,
        bodySerializer: (b: unknown) => b as BodyInit,
        headers: { "Content-Type": file.type },
      })
    ),
  members: async (orgId: string) => unwrap(await api().GET("/org/{orgId}/members", { params: { path: o(orgId) } })),
  addMember: async (orgId: string, phone: string, role: "admin" | "staff") => unwrap(await api().POST("/org/{orgId}/members", { params: { path: o(orgId) }, body: { phone, role } })),
  removeMember: async (orgId: string, memberId: string) => unwrap(await api().POST("/org/{orgId}/members/{memberId}/remove", { params: { path: { orgId, memberId } } })),
};

// ---------------- pure helpers (tested)

/** WCAG contrast ratio of two #rrggbb colours (the server checks the same: 4.5:1 for AA). */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
export const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

/** The fund a draft still needs, or what blocks it, as a console label key. */
export function fundState(f: Pick<Fund, "required" | "deposited">): "funded" | "needs" | "over" {
  if (f.deposited === f.required) return "funded";
  return f.deposited < f.required ? "needs" : "over";
}
