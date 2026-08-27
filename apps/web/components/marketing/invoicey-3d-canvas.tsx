"use client";

import { useEffect, useRef } from "react";

import { normalizePointerPosition } from "./pointer-motion";
import type { Invoicey3DScene } from "./invoicey-3d-scene";
import styles from "./marketing-motion.module.css";

type Invoicey3DCanvasProps = Readonly<{
  celebrationId: number;
  onReadyChange: (ready: boolean) => void;
}>;

const DESKTOP_3D_QUERY = "(min-width: 768px) and (pointer: fine)";

export function Invoicey3DCanvas({
  celebrationId,
  onReadyChange,
}: Invoicey3DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const celebrationRef = useRef(celebrationId);
  const onReadyChangeRef = useRef(onReadyChange);
  const sceneRef = useRef<Invoicey3DScene | null>(null);

  useEffect(() => {
    onReadyChangeRef.current = onReadyChange;
  }, [onReadyChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia(DESKTOP_3D_QUERY).matches) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let visibilityObserver: IntersectionObserver | null = null;
    const interactionTarget = canvas.closest("button");

    const updatePointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      sceneRef.current?.setPointer(
        normalizePointerPosition(
          { x: event.clientX, y: event.clientY },
          bounds,
        ),
      );
    };
    const updateScrollProgress = () => {
      const height = Math.max(canvas.clientHeight, 1);
      sceneRef.current?.setScrollProgress(window.scrollY / height);
    };
    const markHovered = () => sceneRef.current?.setHovered(true);
    const markIdle = () => sceneRef.current?.setHovered(false);
    const handleContextLost = () => {
      sceneRef.current?.setActive(false);
      onReadyChangeRef.current(false);
    };

    const initialize = async () => {
      try {
        const { createInvoicey3DScene } = await import("./invoicey-3d-scene");
        const scene = createInvoicey3DScene(canvas);
        if (cancelled) {
          scene.dispose();
          return;
        }

        sceneRef.current = scene;
        resizeObserver = new ResizeObserver(scene.resize);
        resizeObserver.observe(canvas);
        visibilityObserver = new IntersectionObserver(([entry]) => {
          scene.setActive(entry?.isIntersecting ?? false);
        });
        visibilityObserver.observe(canvas);
        window.addEventListener("pointermove", updatePointer, {
          passive: true,
        });
        window.addEventListener("scroll", updateScrollProgress, {
          passive: true,
        });
        interactionTarget?.addEventListener("pointerenter", markHovered);
        interactionTarget?.addEventListener("pointerleave", markIdle);
        canvas.addEventListener("webglcontextlost", handleContextLost);
        updateScrollProgress();
        onReadyChangeRef.current(true);
      } catch {
        onReadyChangeRef.current(false);
      }
    };

    void initialize();
    return () => {
      cancelled = true;
      window.removeEventListener("pointermove", updatePointer);
      window.removeEventListener("scroll", updateScrollProgress);
      interactionTarget?.removeEventListener("pointerenter", markHovered);
      interactionTarget?.removeEventListener("pointerleave", markIdle);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      sceneRef.current?.dispose();
      sceneRef.current = null;
      onReadyChangeRef.current(false);
    };
  }, []);

  useEffect(() => {
    if (celebrationId === celebrationRef.current) return;
    celebrationRef.current = celebrationId;
    sceneRef.current?.celebrate();
  }, [celebrationId]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={styles.mascotCanvas}
    />
  );
}
