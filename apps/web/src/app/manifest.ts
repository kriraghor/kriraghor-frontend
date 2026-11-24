import type { MetadataRoute } from "next";
import { MANIFEST_ICONS } from "@kriraghor/ui/brand/icons";

/** Web app manifest: kriraghor.com can be added to the home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kriraghor",
    short_name: "Kriraghor",
    description: "Esports, venues, gear and talent for players in Bangladesh.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f5f3",
    theme_color: "#0b7a4b",
    icons: MANIFEST_ICONS,
  };
}
