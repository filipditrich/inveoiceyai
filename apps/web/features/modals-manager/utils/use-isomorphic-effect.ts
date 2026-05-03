import { useEffect, useLayoutEffect } from "react";

/** `useLayoutEffect` in the browser, `useEffect` on SSR. */
export const useIsomorphicEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
