"use client";

import Image from "next/image";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import { Invoicey3DCanvas } from "./invoicey-3d-canvas";
import {
  normalizePointerPosition,
  shouldShowFloatingGuide,
} from "./pointer-motion";
import styles from "./marketing-motion.module.css";

type InteractiveInvoiceyProps = Readonly<{
  ariaLabel: string;
  clickHint: string;
  messages: readonly string[];
}>;

type FloatingInvoiceyGuideProps = Readonly<{
  ariaLabel: string;
  messages: readonly string[];
}>;

function usePointerMotion(elementRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let animationFrame: number | undefined;
    let pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const renderPointer = () => {
      animationFrame = undefined;
      const element = elementRef.current;
      if (!element) return;

      const normalized = normalizePointerPosition(pointer, {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      });
      element.style.setProperty("--pointer-x", normalized.x.toFixed(3));
      element.style.setProperty("--pointer-y", normalized.y.toFixed(3));
    };

    const trackPointer = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      if (animationFrame !== undefined) return;
      animationFrame = window.requestAnimationFrame(renderPointer);
    };

    window.addEventListener("pointermove", trackPointer, { passive: true });
    return () => {
      window.removeEventListener("pointermove", trackPointer);
      if (animationFrame !== undefined) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [elementRef]);
}

function nextMessage(current: number, messages: readonly string[]) {
  return (current + 1) % messages.length;
}

export function InteractiveInvoicey({
  ariaLabel,
  clickHint,
  messages,
}: InteractiveInvoiceyProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [interactionCount, setInteractionCount] = useState(0);
  const [threeReady, setThreeReady] = useState(false);
  usePointerMotion(stageRef);

  return (
    <div ref={stageRef} className={styles.mascotStage}>
      <div className={styles.mascotGlow} />
      <div className={`${styles.orbitChip} ${styles.orbitChipPdf}`}>PDF</div>
      <div className={`${styles.orbitChip} ${styles.orbitChipIsdoc}`}>
        ISDOC
      </div>
      <div className={`${styles.orbitChip} ${styles.orbitChipAres}`}>ARES</div>
      <div className={styles.mascotMessage} aria-live="polite">
        <span>{messages[interactionCount % messages.length]}</span>
        <small>{clickHint}</small>
      </div>
      <button
        type="button"
        className={`${styles.mascotButton} ${threeReady ? styles.mascotButton3DReady : ""}`}
        aria-label={ariaLabel}
        onClick={() => setInteractionCount((current) => current + 1)}
      >
        <Image
          alt=""
          className={styles.mascotImage}
          height={1000}
          priority
          sizes="(max-width: 1023px) 82vw, 520px"
          src="/brand/illustrations/invoicey-mascot.webp"
          width={1000}
        />
        <Invoicey3DCanvas
          celebrationId={interactionCount}
          onReadyChange={setThreeReady}
        />
      </button>
      <Image
        alt=""
        aria-hidden="true"
        className={styles.mascotDocument}
        height={820}
        sizes="150px"
        src="/brand/illustrations/invoicey-document.webp"
        width={820}
      />
      <div className={styles.mascotShadow} />
    </div>
  );
}

export function FloatingInvoiceyGuide({
  ariaLabel,
  messages,
}: FloatingInvoiceyGuideProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const wideScreen = window.matchMedia("(min-width: 1024px)");
    const updateVisibility = () => {
      setVisible(
        shouldShowFloatingGuide({
          documentHeight: document.documentElement.scrollHeight,
          scrollY: window.scrollY,
          viewportHeight: window.innerHeight,
          wideScreen: wideScreen.matches,
        }),
      );
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    wideScreen.addEventListener("change", updateVisibility);
    return () => {
      window.removeEventListener("scroll", updateVisibility);
      wideScreen.removeEventListener("change", updateVisibility);
    };
  }, []);

  return (
    <aside
      className={`${styles.floatingGuide} ${visible ? styles.floatingGuideVisible : ""}`}
      aria-hidden={!visible}
    >
      <div className={styles.floatingGuideMessage} aria-live="polite">
        {messages[messageIndex]}
      </div>
      <button
        type="button"
        aria-label={ariaLabel}
        tabIndex={visible ? 0 : -1}
        onClick={() =>
          setMessageIndex((current) => nextMessage(current, messages))
        }
      >
        <Image
          alt=""
          height={1000}
          sizes="112px"
          src="/brand/illustrations/invoicey-mascot.webp"
          width={1000}
        />
      </button>
    </aside>
  );
}
