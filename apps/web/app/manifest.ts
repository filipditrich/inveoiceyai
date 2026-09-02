import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Invoicey",
    short_name: "Invoicey",
    description: "Automatizace faktur — PDF, ISDOC, SPAYD QR a AI.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    lang: "cs",
    icons: [
      {
        src: "/brand/invoicey-logo-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/invoicey-logo-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
