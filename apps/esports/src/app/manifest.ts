import type { MetadataRoute } from "next";
import { MANIFEST_ICONS } from "@kriraghor/ui/brand/icons";

/** PWA manifest: esports.kriraghor.com installs to the home screen (offline support comes with M21). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kriraghor Esports",
    short_name: "Kriraghor",
    description: "PUBG Mobile and Free Fire tournaments with real prizes.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a1a12",
    theme_color: "#0b7a4b",
    icons: MANIFEST_ICONS,
  };
}
