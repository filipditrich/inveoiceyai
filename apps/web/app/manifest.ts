import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Invoicey",
    short_name: "Invoicey",
    description: "Česká fakturace — PDF, ISDOC, SPAYD QR a AI automatizace.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fffaf6",
    theme_color: "#dc9b79",
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
