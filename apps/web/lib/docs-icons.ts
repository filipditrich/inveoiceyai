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
  HardDriveIcon,
  HashIcon,
  KeyRoundIcon,
  LandmarkIcon,
  LibraryIcon,
  ListChecksIcon,
  MessageSquareIcon,
  MousePointer2Icon,
  PercentIcon,
  PlugIcon,
  QrCodeIcon,
  RocketIcon,
  SendIcon,
  SnowflakeIcon,
  SquareTerminalIcon,
  StampIcon,
  UsersIcon,
  WorkflowIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";

/**
 * Lucide names allowed in `content/docs` frontmatter `icon:` fields.
 *
 * Fumadocs only renders an icon when this map has an entry — an unknown name
 * silently drops the sidebar glyph.
 */
export const DOC_ICONS: Record<string, LucideIcon> = {
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
  HardDrive: HardDriveIcon,
  Hash: HashIcon,
  KeyRound: KeyRoundIcon,
  Landmark: LandmarkIcon,
  Library: LibraryIcon,
  ListChecks: ListChecksIcon,
  MessageSquare: MessageSquareIcon,
  MousePointer2: MousePointer2Icon,
  Percent: PercentIcon,
  Plug: PlugIcon,
  QrCode: QrCodeIcon,
  Rocket: RocketIcon,
  Send: SendIcon,
  Snowflake: SnowflakeIcon,
  SquareTerminal: SquareTerminalIcon,
  Stamp: StampIcon,
  Users: UsersIcon,
  Workflow: WorkflowIcon,
  Wrench: WrenchIcon,
};

export function resolveDocIcon(
  name: string | undefined,
): LucideIcon | undefined {
  return name ? DOC_ICONS[name] : undefined;
}
