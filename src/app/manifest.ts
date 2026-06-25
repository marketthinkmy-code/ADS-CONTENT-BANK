import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ADS Content Bank Cloud Cron",
    short_name: "ADS Cron",
    description: "Cloud cron automation for Meta Ad Library ideas to Notion.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#111827",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
