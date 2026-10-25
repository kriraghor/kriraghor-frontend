import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "../admin/finance";

/**
 * The gym owner's gyms as the business panel still shows them (the vendor home's gym tiles and the
 * reviews place switcher). Managing a gym (the editor, the front desk, the passes sold) moved to
 * gym.kriraghor.com/manage on 25 Oct 2026 (M24 §4.3); its client is apps/gym/src/lib/manage.ts.
 */
export type OwnerGym = components["schemas"]["OwnerGym"];

export const gymDesk = {
  mine: async () => unwrap(await api().GET("/me/gyms")),
};
