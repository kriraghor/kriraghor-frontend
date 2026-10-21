import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./finance";

/**
 * Admin bookings (M10): the list for ops (manage_users or view_payouts), a booking with its ledger
 * trail, and the master's platform cancel with a full refund (step-up escrow.manage).
 */
export type StaffBooking = components["schemas"]["StaffBooking"];
export type StaffBookingRow = components["schemas"]["StaffBookingList"]["items"][number];
export type BookingStatus = NonNullable<StaffBookingRow["status"]>;

export const bookingsAdmin = {
  list: async (query: { status?: string; code?: string; cursor?: string }) =>
    unwrap(
      await api("admin").GET("/admin/bookings", {
        params: { query: { ...(query.status ? { status: query.status as never } : {}), ...(query.code ? { code: query.code } : {}), ...(query.cursor ? { cursor: query.cursor } : {}), limit: 50 } },
      }),
    ),
  get: async (id: string) => unwrap(await api("admin").GET("/admin/bookings/{id}", { params: { path: { id } } })),
  cancel: async (id: string, reason: string, stepUpToken: string) => unwrap(await api("admin").POST("/admin/bookings/{id}/cancel", { params: { path: { id }, header: { "x-step-up": stepUpToken } }, body: { reason } })),
};
