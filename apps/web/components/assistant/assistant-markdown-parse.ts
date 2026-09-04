export type AssistantMarkdownBlock =
  | { kind: "blank" }
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "ordered"; items: string[] };

const BULLET = /^\s*[-•*]\s+(.*)$/u;
const ORDERED = /^\s*\d+\.\s+(.*)$/u;

/**
 * Groups the agent's reply into the few block kinds the panel renderer knows.
 * Numbered lines become one ordered block so `1.` is not a bare paragraph.
 */
export function parseAssistantMarkdown(text: string): AssistantMarkdownBlock[] {
  const lines = text.trim().split("\n");
  const blocks: AssistantMarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      blocks.push({ kind: "blank" });
      index += 1;
      continue;
    }

    const bullets = takeRun(lines, index, BULLET);
    if (bullets) {
      blocks.push({ kind: "bullets", items: bullets.items });
      index = bullets.next;
      continue;
    }

    const ordered = takeRun(lines, index, ORDERED);
    if (ordered) {
      blocks.push({ kind: "ordered", items: ordered.items });
      index = ordered.next;
      continue;
    }

    blocks.push({ kind: "paragraph", text: line });
    index += 1;
  }

  return blocks;
}

function takeRun(
  lines: string[],
  start: number,
  pattern: RegExp,
): { items: string[]; next: number } | null {
  const items: string[] = [];
  let index = start;
  while (index < lines.length) {
    const match = pattern.exec(lines[index] ?? "");
    if (!match) break;
    items.push(match[1] ?? "");
    index += 1;
  }
  if (items.length === 0) return null;
  return { items, next: index };
}
