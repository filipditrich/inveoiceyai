"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

const STORAGE_KEY = "invoicey.assistant.panelWidth";
const KEYBOARD_STEP = 24;

export const ASSISTANT_PANEL_MIN_WIDTH = 320;
export const ASSISTANT_PANEL_DEFAULT_WIDTH = 480;
export const ASSISTANT_PANEL_MAX_WIDTH = 720;

/**
 * Keeps the panel usable on narrow viewports and never lets it swallow the
 * whole page on wide ones — the 96px margin leaves room to see what the
 * assistant is talking about.
 */
export function clampPanelWidth(width: number, viewportWidth: number): number {
  const max = Math.max(
    ASSISTANT_PANEL_MIN_WIDTH,
    Math.min(ASSISTANT_PANEL_MAX_WIDTH, viewportWidth - 96),
  );
  return Math.min(Math.max(width, ASSISTANT_PANEL_MIN_WIDTH), max);
}

function readStoredWidth(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStoredWidth(width: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Math.round(width)));
  } catch {
    /** quota or a private window — width just resets next time */
  }
}

export interface AssistantPanelWidthControls {
  width: number;
  resizing: boolean;
  onHandlePointerDown: (event: ReactPointerEvent) => void;
  onHandleKeyDown: (event: ReactKeyboardEvent) => void;
}

/**
 * Drag-to-resize for the assistant drawer's left edge.
 *
 * The panel is pinned to the right edge of the screen, so growing it means
 * dragging the handle left — width tracks how far the pointer moved from
 * where the drag started, not its absolute position. Width persists across
 * sessions so a wider panel stays wide next time the assistant opens.
 */
export function useAssistantPanelWidth(): AssistantPanelWidthControls {
  const [width, setWidth] = useState(ASSISTANT_PANEL_DEFAULT_WIDTH);
  const [resizing, setResizing] = useState(false);
  const dragStart = useRef<{ pointerX: number; width: number } | null>(null);

  useEffect(() => {
    const stored = readStoredWidth();
    if (stored !== null) {
      setWidth(clampPanelWidth(stored, window.innerWidth));
    }
  }, []);

  /** Dragging over the transcript would otherwise select its text. */
  useEffect(() => {
    if (!resizing) return;
    const previous = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = previous;
    };
  }, [resizing]);

  useEffect(() => {
    if (!resizing) return;

    function onMove(event: globalThis.PointerEvent) {
      const start = dragStart.current;
      if (!start) return;
      const delta = start.pointerX - event.clientX;
      setWidth(clampPanelWidth(start.width + delta, window.innerWidth));
    }
    function onUp() {
      setResizing(false);
      dragStart.current = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizing]);

  useEffect(() => {
    writeStoredWidth(width);
  }, [width]);

  const onHandlePointerDown = useCallback(
    (event: ReactPointerEvent) => {
      dragStart.current = { pointerX: event.clientX, width };
      setResizing(true);
    },
    [width],
  );

  const onHandleKeyDown = useCallback((event: ReactKeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setWidth((current) =>
        clampPanelWidth(current + KEYBOARD_STEP, window.innerWidth),
      );
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setWidth((current) =>
        clampPanelWidth(current - KEYBOARD_STEP, window.innerWidth),
      );
    }
  }, []);

  return { width, resizing, onHandlePointerDown, onHandleKeyDown };
}
