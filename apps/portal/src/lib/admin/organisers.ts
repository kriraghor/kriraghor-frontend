import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./finance";

/**
 * Organiser desk client (M14 lite and M22, admin.kriraghor.com/admin/esports/organisers):
 * organisations (suspend with manage_organisers, restore for masters), their contracts (draft, the
 * signed PDF, activate / suspend / end with step-up esports.money) and invoices (void with step-up).
 * Organisation reviews are on the Moderation desk (kind organisation).
 */
export type StaffOrganisation = components["schemas"]["StaffOrganisation"];
export type OrganisationRow = components["schemas"]["Organisation"];
export type Contract = components["schemas"]["OrganiserContract"];
export type Invoice = components["schemas"]["OrganiserInvoice"];
export type OrgStatus = OrganisationRow["status"];
export type ContractInput = { model: "percentage" | "flat"; pct?: number | null; flatFee?: number | null; billingCycle: "monthly" | "quarterly" | "per_tournament"; startsOn: string; endsOn?: string | null; notes?: string | null };

const id = (v: string) => ({ path: { id: v } });
const step = (token: string) => ({ "x-step-up": token });

export const organisersAdmin = {
  list: async (q: { status?: OrgStatus; q?: string }) => unwrap(await api("admin").GET("/admin/organisers", { params: { query: { ...(q.status ? { status: q.status } : {}), ...(q.q ? { q: q.q } : {}) } } })),
  get: async (oid: string) => unwrap(await api("admin").GET("/admin/organisers/{id}", { params: id(oid) })),
  suspend: async (oid: string, reason: string) => unwrap(await api("admin").POST("/admin/organisers/{id}/suspend", { params: id(oid), body: { reason } })),
  restore: async (oid: string, reason: string) => unwrap(await api("admin").POST("/admin/organisers/{id}/restore", { params: id(oid), body: { reason } })),
  contracts: async (oid: string) => unwrap(await api("admin").GET("/admin/organisers/{id}/contracts", { params: id(oid) })),
  createContract: async (oid: string, body: ContractInput) => unwrap(await api("admin").POST("/admin/organisers/{id}/contracts", { params: id(oid), body })),
  attachDocument: async (cid: string, file: File) =>
    unwrap(
      await api("admin").POST("/admin/organisers/contracts/{id}/document", {
        params: id(cid),
        body: file as unknown as string,
        bodySerializer: (b: unknown) => b as BodyInit,
        headers: { "Content-Type": file.type || "application/pdf" },
      })
    ),
  activate: async (cid: string, token: string) => unwrap(await api("admin").POST("/admin/organisers/contracts/{id}/activate", { params: { ...id(cid), header: step(token) } })),
  stop: async (cid: string, to: "suspend" | "end", reason: string, token: string) =>
    unwrap(await api("admin").POST(to === "suspend" ? "/admin/organisers/contracts/{id}/suspend" : "/admin/organisers/contracts/{id}/end", { params: { ...id(cid), header: step(token) }, body: { reason } })),
  invoices: async (organisationId: string) => unwrap(await api("admin").GET("/admin/organisers/invoices", { params: { query: { organisationId } } })),
  voidInvoice: async (iid: string, reason: string, token: string) => unwrap(await api("admin").POST("/admin/organisers/invoices/{id}/void", { params: { ...id(iid), header: step(token) }, body: { reason } })),
};

/** A contract form → the API body (taka text to poisha); null when the numbers are not right. */
export function contractBody(f: { model: "percentage" | "flat"; pct: string; flatFee: string; billingCycle: ContractInput["billingCycle"]; startsOn: string; endsOn: string }): ContractInput | null {
  if (f.model === "percentage") {
    const pct = f.pct.trim() === "" ? null : Number(f.pct);
    if (pct !== null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) return null;
    return { model: "percentage", pct, billingCycle: "per_tournament", startsOn: f.startsOn, endsOn: f.endsOn || null };
  }
  const taka = Number(f.flatFee);
  if (!Number.isFinite(taka) || taka <= 0 || f.billingCycle === "per_tournament") return null;
  return { model: "flat", flatFee: Math.round(taka * 100), billingCycle: f.billingCycle, startsOn: f.startsOn, endsOn: f.endsOn || null };
}
