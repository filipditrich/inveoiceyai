/** Basic inline markdown: `**bold**`, `*italic*`, `_italic_`. */

export type InlineMarkdownSpan = {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
};

type Marker = {
  readonly open: string;
  readonly close: string;
  readonly bold: boolean;
  readonly italic: boolean;
};

const MARKERS: readonly Marker[] = [
  { open: "**", close: "**", bold: true, italic: false },
  { open: "*", close: "*", bold: false, italic: true },
  { open: "_", close: "_", bold: false, italic: true },
];

function pushPlain(
  spans: InlineMarkdownSpan[],
  text: string,
  bold: boolean,
  italic: boolean,
): void {
  if (text.length === 0) {
    return;
  }
  const last = spans[spans.length - 1];
  if (last && last.bold === bold && last.italic === italic) {
    spans[spans.length - 1] = {
      text: last.text + text,
      bold,
      italic,
    };
    return;
  }
  spans.push({ text, bold, italic });
}

export function parseInlineMarkdown(line: string): InlineMarkdownSpan[] {
  const spans: InlineMarkdownSpan[] = [];
  let i = 0;

  while (i < line.length) {
    let matched: Marker | null = null;
    for (const marker of MARKERS) {
      if (line.startsWith(marker.open, i)) {
        matched = marker;
        break;
      }
    }

    if (!matched) {
      const nextSpecial = findNextMarkerIndex(line, i + 1);
      pushPlain(spans, line.slice(i, nextSpecial), false, false);
      i = nextSpecial;
      continue;
    }

    const contentStart = i + matched.open.length;
    const closeAt = line.indexOf(matched.close, contentStart);
    if (closeAt === -1 || closeAt === contentStart) {
      /** unmatched marker — keep literal */
      pushPlain(spans, matched.open, false, false);
      i = contentStart;
      continue;
    }

    pushPlain(
      spans,
      line.slice(contentStart, closeAt),
      matched.bold,
      matched.italic,
    );
    i = closeAt + matched.close.length;
  }

  return spans;
}

function findNextMarkerIndex(line: string, from: number): number {
  let best = line.length;
  for (const marker of MARKERS) {
    const at = line.indexOf(marker.open, from);
    if (at !== -1 && at < best) {
      best = at;
    }
  }
  return best;
}

/** Strip markers, keep visible text (ISDOC notes, etc.). */
export function stripInlineMarkdown(source: string): string {
  return source
    .split(/\r?\n/)
    .map((line) =>
      parseInlineMarkdown(line)
        .map((s) => s.text)
        .join(""),
    )
    .join("\n");
}
