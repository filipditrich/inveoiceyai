import type { CSSProperties } from "react";

import type { LookStyleBox } from "../looks/style-ir";

const LENGTH_KEYS = new Set([
  "fontSize",
  "paddingTop",
  "paddingBottom",
  "paddingRight",
  "paddingLeft",
  "marginTop",
  "marginBottom",
  "width",
  "height",
  "maxHeight",
  "bottom",
  "left",
  "right",
  "borderBottomWidth",
  "borderTopWidth",
]);

function assignLookCss(css: CSSProperties, box: LookStyleBox): CSSProperties {
  for (const [key, value] of Object.entries(box)) {
    if (value === undefined) continue;
    if (key === "paddingHorizontal" && typeof value === "number") {
      css.paddingLeft = pt(value);
      css.paddingRight = pt(value);
      continue;
    }
    if (key === "paddingVertical" && typeof value === "number") {
      css.paddingTop = pt(value);
      css.paddingBottom = pt(value);
      continue;
    }
    if (key === "flexDirection" && (value === "row" || value === "column")) {
      css.flexDirection = value;
      continue;
    }
    if (typeof value === "number" && LENGTH_KEYS.has(key) && key !== "width") {
      Object.assign(css, { [key]: pt(value) });
      continue;
    }
    if (key === "width" && typeof value === "number") {
      css.width = pt(value);
      continue;
    }
    Object.assign(css, { [key]: value });
  }
  return css;
}

function pt(n: number): string {
  return `${String(n)}pt`;
}

/**
 * Layout box. react-pdf Views are flex by default; DOM boxes match that so
 * bands and kv rows lay out the same way.
 */
export function cssFromLookBox(
  box: LookStyleBox,
  extra?: CSSProperties,
): CSSProperties {
  const css = assignLookCss(
    {
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      minWidth: 0,
    },
    box,
  );
  return extra ? { ...css, ...extra } : css;
}

/** Text run — no flex container, so title/kv labels stay inline-shaped. */
export function cssFromLookText(
  box: LookStyleBox,
  extra?: CSSProperties,
): CSSProperties {
  const css = assignLookCss({ boxSizing: "border-box" }, box);
  return extra ? { ...css, ...extra } : css;
}
