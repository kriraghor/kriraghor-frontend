import type { MetadataRoute } from "next";

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
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
