"use client";

import { useEffect, type ReactNode } from "react";

import styles from "./marketing-motion.module.css";

/**
 * Plays `.scrollReveal` once as each block enters the viewport.
 * Snipr-style: ease-out fade/slide that finishes, instead of scrubbing
 * the animation to the scroll position.
 */
export function MarketingReveal({
  children,
}: Readonly<{ children: ReactNode }>) {
  useEffect(() => {
    const nodes = [
      ...document.querySelectorAll<HTMLElement>(`.${styles.scrollReveal}`),
    ];
    if (nodes.length === 0) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const node of nodes) {
        node.dataset.inview = "";
      }
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          const el = entry.target;
          if (!(el instanceof HTMLElement)) {
            continue;
          }
          el.dataset.inview = "";
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );

    for (const [index, node] of nodes.entries()) {
      node.style.setProperty(
        "--reveal-delay",
        `${Math.min(index % 6, 5) * 55}ms`,
      );
      io.observe(node);
    }

    return () => io.disconnect();
  }, []);

  return children;
}
