import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
const { outputFiles } = await build({
  entryPoints: ["tests/mcp-ui/host.ts"],
  bundle: true,
  write: false,
  format: "esm",
  target: "es2022",
});
const host = outputFiles[0].text;
const widget = await readFile("public/mcp/invoicey.html", "utf8");
createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.url === "/host.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(host);
    return;
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  if (request.url === "/widget") {
    response.end(widget);
    return;
  }
  response.end(
    '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoicey MCP Apps test host</title><style>body{margin:0;background:#f3f3f3}iframe{display:block;width:100%;min-height:100vh;border:0}</style></head><body><iframe title="Invoicey"></iframe><script type="module" src="/host.js"></script></body></html>',
  );
}).listen(3120, "127.0.0.1", () =>
  console.log("MCP UI test host: http://127.0.0.1:3120"),
);
