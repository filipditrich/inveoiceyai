/** Marketing homepage — public, reachable while signed in. */
export const MARKETING_HOME_HREF = "/";

export const DOCS_APP_HREF = "/dashboard";

export type DocsChromeLink = {
  text: string;
  url: string;
  kind: "main" | "button";
};

/**
 * Docs sidebar chrome above the page tree: homepage first, then the app.
 */
export function docsChromeLinks(): DocsChromeLink[] {
  return [
    { text: "Home", url: MARKETING_HOME_HREF, kind: "main" },
    { text: "Open app", url: DOCS_APP_HREF, kind: "button" },
  ];
}

export type AppResourceLinkKey = "home" | "docs";

export type AppResourceLink = {
  key: AppResourceLinkKey;
  url: string;
  isActive: boolean;
};

/**
 * App sidebar Resources group: marketing homepage, then product docs.
 */
export function appResourceLinks(pathname: string): AppResourceLink[] {
  return [
    {
      key: "home",
      url: MARKETING_HOME_HREF,
      isActive: pathname === MARKETING_HOME_HREF,
    },
    {
      key: "docs",
      url: "/docs",
      isActive: pathname === "/docs" || pathname.startsWith("/docs/"),
    },
  ];
}
