"use client";

import { json, jsonParseLinter } from "@codemirror/lang-json";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { linter } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import { tags as highlightTags } from "@lezer/highlight";
import CodeMirror from "@uiw/react-codemirror";

interface InvoiceJsonEditorProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const editorTheme = EditorView.theme({
  "&": {
    color: "var(--foreground)",
    backgroundColor: "transparent",
    fontSize: "0.8125rem",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-content": {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    caretColor: "var(--foreground)",
    paddingTop: "0.625rem",
    paddingBottom: "0.625rem",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--muted-foreground)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in oklab, var(--muted) 45%, transparent)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--foreground)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in oklab, var(--foreground) 14%, transparent)",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--foreground)",
  },
});

const jsonHighlight = HighlightStyle.define([
  { tag: highlightTags.propertyName, color: "var(--foreground)" },
  { tag: highlightTags.string, color: "var(--muted-foreground)" },
  { tag: highlightTags.number, color: "var(--foreground)" },
  { tag: highlightTags.bool, color: "var(--foreground)" },
  { tag: highlightTags.null, color: "var(--muted-foreground)" },
  { tag: highlightTags.punctuation, color: "var(--muted-foreground)" },
  { tag: highlightTags.invalid, color: "var(--destructive)" },
]);

const extensions = [
  json(),
  linter(jsonParseLinter()),
  syntaxHighlighting(jsonHighlight),
  EditorView.lineWrapping,
  editorTheme,
];

export function InvoiceJsonEditor(props: InvoiceJsonEditorProps) {
  const { id, label, value, onChange, disabled } = props;
  return (
    <div className="overflow-hidden rounded-lg border border-input" id={id}>
      <CodeMirror
        aria-label={label}
        basicSetup={{
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          lineNumbers: true,
        }}
        editable={!disabled}
        extensions={extensions}
        height="28rem"
        onChange={onChange}
        theme="none"
        value={value}
      />
    </div>
  );
}
