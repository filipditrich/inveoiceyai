import tailwindcss from "@tailwindcss/postcss";
import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import postcss from "postcss";
const messages = {};
for (const locale of ["cs", "en"])
  messages[locale] = JSON.parse(
    await readFile(`locales/${locale}.json`, "utf8"),
  ).McpApp;
const result = await build({
  entryPoints: ["mcp-ui/app.tsx"],
  bundle: true,
  conditions: ["style", "browser"],
  minify: true,
  format: "iife",
  target: "es2022",
  jsx: "automatic",
  write: false,
  outdir: "public/mcp",
  loader: { ".woff2": "dataurl", ".woff": "dataurl", ".ttf": "dataurl" },
  define: {
    INVOICEY_MESSAGES: JSON.stringify(messages),
    "process.env.NODE_ENV": '"production"',
  },
});
const javascript = result.outputFiles.find((file) =>
  file.path.endsWith(".js"),
)?.text;
const css = result.outputFiles.find((file) => file.path.endsWith(".css"))?.text;
if (!javascript || !css) throw new Error("MCP UI bundle is missing");
const styles = await postcss([tailwindcss()]).process(
  "@layer theme, base, components, utilities;\n" + css,
  { from: "mcp-ui/styles.css" },
);
const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoicey</title><style>${styles.css.replaceAll("</style", "<\\/style")}</style></head><body><div id="root"></div><script>${javascript.replaceAll("</script", "<\\/script")}</script></body></html>`;
await mkdir("public/mcp", { recursive: true });
await writeFile("public/mcp/invoicey.html", html);
console.log(
  `Invoicey MCP UI: ${Math.round(Buffer.byteLength(html) / 1024)} KiB`,
);
