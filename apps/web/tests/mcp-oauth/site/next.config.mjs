import createNextIntlPlugin from "next-intl/plugin";
export default createNextIntlPlugin("./i18n.ts")({
  devIndicators: false,
  experimental: { externalDir: true },
});
