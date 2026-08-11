import { loader, type Source } from "fumadocs-core/source";
import { defineDocs } from "fumadocs-mdx/macro";

/**
 * Public product documentation served at `/docs` (`content/docs/**`).
 *
 * `defineDocs` is a build-time macro — the `dir` argument must stay a string
 * literal, and the collection is compiled by the `createMDX()` loader in
 * `next.config.ts`. There is no generated `.source` directory to keep in sync.
 *
 * This is deliberately separate from the repo's internal `docs/` folder: that
 * one is the engineering source of truth (ADRs, specs, roadmap) and is not
 * shipped to users.
 */
const docs = defineDocs({
  dir: "content/docs",
});

/**
 * `fumadocs-mdx` bundles its own copy of the `fumadocs-core/source` types, so
 * the `Source` it returns is a structurally identical but distinct declaration.
 * `loader()` cannot infer through that boundary and silently falls back to the
 * bare `PageData` default — which loses `body`, `toc` and `full` on every page.
 * Annotating against the real core type restores the inference.
 */
type DocsSource = Source<{
  pageData: (typeof docs)["docs"][number];
  metaData: (typeof docs)["meta"][number];
}>;

const docsSource: DocsSource = docs.toFumadocsSource();

export const source = loader(docsSource, {
  baseUrl: "/docs",
});
