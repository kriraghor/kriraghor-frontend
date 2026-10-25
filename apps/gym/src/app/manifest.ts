import type { MetadataRoute } from "next";

/** PWA manifest: gym.kriraghor.com installs to the home screen (the gym theme: dark with the lime accent). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kriraghor Gym",
    short_name: "Kriraghor Gym",
    description: "Gym passes from verified gyms, monthly plans with trainers, and the tools to run a gym.",
    start_url: "/",
    display: "standalone",
    background_color: "#111210",
    theme_color: "#c8f53c",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
