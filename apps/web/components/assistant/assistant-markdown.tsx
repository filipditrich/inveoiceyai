"use client";

import type { ReactNode } from "react";

import {
  parseAssistantMarkdown,
  type AssistantMarkdownBlock,
} from "./assistant-markdown-parse";

/**
 * The small slice of markdown the agent actually replies with.
 *
 * Replies are instructed to stay short — details belong on the card — so this
 * covers `*bold*`/`**bold**`, `_italic_`, `` `code` ``, bullets and numbered
 * lists, and deliberately nothing else. A full markdown pipeline in the
 * browser bundle would be a lot of weight for one-line answers.
 */
export function AssistantMarkdown({ text }: { text: string }) {
  const blocks = parseAssistantMarkdown(text);

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((block, index) => (
        <MarkdownBlock block={block} key={index} />
      ))}
    </div>
  );
}

function MarkdownBlock({ block }: { block: AssistantMarkdownBlock }) {
  switch (block.kind) {
    case "blank":
      return <div className="h-1" />;
    case "paragraph":
      return <p>{inline(block.text)}</p>;
    case "bullets":
      return (
        <ul className="flex flex-col gap-1.5">
          {block.items.map((item, index) => (
            <li className="flex gap-2" key={index}>
              <span aria-hidden className="text-muted-foreground">
                •
              </span>
              <span>{inline(item)}</span>
            </li>
          ))}
        </ul>
      );
    case "ordered":
      return (
        <ol className="flex flex-col gap-1.5">
          {block.items.map((item, index) => (
            <li className="flex gap-2" key={index}>
              <span
                aria-hidden
                className="w-4 shrink-0 text-right text-muted-foreground tabular-nums"
              >
                {index + 1}.
              </span>
              <span>{inline(item)}</span>
            </li>
          ))}
        </ol>
      );
  }
}

/** Splits on the marker tokens and rebuilds the line as React nodes. */
function inline(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/gu;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));
    lastIndex = start + token.length;

    if (token.startsWith("`")) {
      nodes.push(
        <code
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8em]"
          key={key++}
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      /** Slack's single-asterisk bold, which the agent also uses in cards. */
      nodes.push(<strong key={key++}>{token.slice(1, -1)}</strong>);
    } else {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
