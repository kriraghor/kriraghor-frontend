export type Area = "admin" | "vendor";

/** admin.* → admin area, vendor.* → vendor area; plain localhost uses PORTAL_DEFAULT_AREA (default admin). */
export function areaForHost(host: string | null, fallback: string | undefined = process.env.PORTAL_DEFAULT_AREA): Area {
  const h = (host ?? "").toLowerCase();
  if (h.startsWith("admin.")) return "admin";
  if (h.startsWith("vendor.")) return "vendor";
  return fallback === "vendor" ? "vendor" : "admin";
}
