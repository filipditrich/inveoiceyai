"use client";

import { useEffect, useRef, type ReactNode } from "react";

import styles from "./marketing-motion.module.css";

function revealNode(node: HTMLElement) {
  node.dataset.inview = "";
}

function isInViewport(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function collectRevealNodes(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(`.${styles.scrollReveal}`)];
}

function attachScrollReveal(root: HTMLElement): () => void {
  if (prefersReducedMotion()) {
    for (const node of collectRevealNodes(root)) {
      revealNode(node);
    }
    return () => {};
  }

  const observed = new WeakSet<Element>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }
        if (!(entry.target instanceof HTMLElement)) {
          continue;
        }
        revealNode(entry.target);
        io.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px 0px 0px", threshold: 0 },
  );

  const observeAll = () => {
    for (const [index, node] of collectRevealNodes(root).entries()) {
      if (node.dataset.inview !== undefined || observed.has(node)) {
        continue;
      }
      observed.add(node);
      node.style.setProperty(
        "--reveal-delay",
        `${Math.min(index % 6, 5) * 55}ms`,
      );
      if (isInViewport(node)) {
        revealNode(node);
        continue;
      }
      io.observe(node);
    }
  };

  observeAll();
  const mutations = new MutationObserver(observeAll);
  mutations.observe(root, { childList: true, subtree: true });
  const fallback = window.setTimeout(() => {
    for (const node of collectRevealNodes(root)) {
      if (node.dataset.inview === undefined) {
        revealNode(node);
      }
    }
  }, 1200);

  return () => {
    io.disconnect();
    mutations.disconnect();
    window.clearTimeout(fallback);
  };
}

/**
 * Plays `.scrollReveal` once as each block enters the viewport.
 * Defaults to visible if the observer never fires (streaming, reduced
 * motion, or a late-mounted section).
 */
export function MarketingReveal({
  children,
}: Readonly<{ children: ReactNode }>) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return undefined;
    }
    return attachScrollReveal(root);
  }, []);

  return <div ref={rootRef}>{children}</div>;
}
