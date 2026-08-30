export type MarkdownWrapKind = "bold" | "italic" | "code" | "list";

export type MarkdownWrapResult = {
  value: string;
  start: number;
  end: number;
};

const MARKERS: Record<
  Exclude<MarkdownWrapKind, "list">,
  { prefix: string; suffix: string }
> = {
  bold: { prefix: "**", suffix: "**" },
  italic: { prefix: "_", suffix: "_" },
  code: { prefix: "`", suffix: "`" },
};

/**
 * Toggle a markdown marker around the current selection, or insert a pair
 * with the caret in the middle when nothing is selected.
 */
export function wrapMarkdownSelection(
  value: string,
  start: number,
  end: number,
  kind: MarkdownWrapKind,
): MarkdownWrapResult {
  const from = Math.max(0, Math.min(start, end, value.length));
  const to = Math.max(0, Math.min(Math.max(start, end), value.length));

  if (kind === "list") return wrapList(value, from, to);

  const { prefix, suffix } = MARKERS[kind];
  const selected = value.slice(from, to);
  if (
    selected.startsWith(prefix) &&
    selected.endsWith(suffix) &&
    selected.length >= prefix.length + suffix.length
  ) {
    const inner = selected.slice(
      prefix.length,
      selected.length - suffix.length,
    );
    return replace(value, from, to, inner, from, from + inner.length);
  }

  const next = `${prefix}${selected}${suffix}`;
  return replace(
    value,
    from,
    to,
    next,
    from + prefix.length,
    from + prefix.length + selected.length,
  );
}

function wrapList(value: string, from: number, to: number): MarkdownWrapResult {
  const lineStart = value.lastIndexOf("\n", Math.max(0, from - 1)) + 1;
  const lineEndIndex = value.indexOf("\n", to);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const anyBullets = lines.some((line) => /^\s*[-*]\s+/u.test(line));
  const nextBlock = anyBullets
    ? lines.map((line) => line.replace(/^\s*[-*]\s+/u, "")).join("\n")
    : lines
        .map((line) => (line.trim() ? `- ${line.replace(/^\s+/u, "")}` : "- "))
        .join("\n");
  return replace(
    value,
    lineStart,
    lineEnd,
    nextBlock,
    lineStart,
    lineStart + nextBlock.length,
  );
}

function replace(
  value: string,
  from: number,
  to: number,
  insert: string,
  start: number,
  end: number,
): MarkdownWrapResult {
  return {
    value: `${value.slice(0, from)}${insert}${value.slice(to)}`,
    start,
    end,
  };
}
