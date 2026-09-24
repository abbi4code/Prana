import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/app";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME}: calorie tracker`,
    short_name: APP_NAME,
    description: "Track calories the Indian way: by katori, roti and plate.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#15100d",
    theme_color: "#15100d",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
