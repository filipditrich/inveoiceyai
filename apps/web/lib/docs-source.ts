import { loader, type Source } from "fumadocs-core/source";
import { defineDocs } from "fumadocs-mdx/macro";
import {
  ArchiveRestoreIcon,
  BookOpenIcon,
  BotIcon,
  BracesIcon,
  Building2Icon,
  CircleDotIcon,
  CircleHelpIcon,
  ContactIcon,
  FileCode2Icon,
  FilePlus2Icon,
  FilesIcon,
  FileTextIcon,
  HashIcon,
  KeyRoundIcon,
  LibraryIcon,
  ListChecksIcon,
  MessageSquareIcon,
  MousePointer2Icon,
  PercentIcon,
  PlugIcon,
  QrCodeIcon,
  RocketIcon,
  SendIcon,
  ServerIcon,
  SnowflakeIcon,
  SquareTerminalIcon,
  StampIcon,
  UsersIcon,
  VariableIcon,
  WorkflowIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { createElement } from "react";

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

const DOC_ICONS: Record<string, LucideIcon> = {
  ArchiveRestore: ArchiveRestoreIcon,
  BookOpen: BookOpenIcon,
  Bot: BotIcon,
  Braces: BracesIcon,
  Building2: Building2Icon,
  CircleDot: CircleDotIcon,
  CircleHelp: CircleHelpIcon,
  Contact: ContactIcon,
  FileCode2: FileCode2Icon,
  FilePlus2: FilePlus2Icon,
  Files: FilesIcon,
  FileText: FileTextIcon,
  Hash: HashIcon,
  KeyRound: KeyRoundIcon,
  Library: LibraryIcon,
  ListChecks: ListChecksIcon,
  MessageSquare: MessageSquareIcon,
  MousePointer2: MousePointer2Icon,
  Percent: PercentIcon,
  Plug: PlugIcon,
  QrCode: QrCodeIcon,
  Rocket: RocketIcon,
  Send: SendIcon,
  Server: ServerIcon,
  Snowflake: SnowflakeIcon,
  SquareTerminal: SquareTerminalIcon,
  Stamp: StampIcon,
  Users: UsersIcon,
  Variable: VariableIcon,
  Workflow: WorkflowIcon,
  Wrench: WrenchIcon,
};

export const source = loader(docsSource, {
  baseUrl: "/docs",
  icon(name) {
    const Icon = name ? DOC_ICONS[name] : undefined;
    return Icon ? createElement(Icon, { className: "size-4" }) : undefined;
  },
});
