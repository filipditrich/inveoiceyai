type PointerPosition = Readonly<{ x: number; y: number }>;

type MotionBounds = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

type FloatingGuideViewport = Readonly<{
  documentHeight: number;
  scrollY: number;
  viewportHeight: number;
  wideScreen: boolean;
}>;

function clampToMotionRange(value: number) {
  return Math.min(1, Math.max(-1, value));
}

export function normalizePointerPosition(
  pointer: PointerPosition,
  bounds: MotionBounds,
): PointerPosition {
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;

  return {
    x: clampToMotionRange((pointer.x - centerX) / (bounds.width / 2)),
    y: clampToMotionRange((pointer.y - centerY) / (bounds.height / 2)),
  };
}

export function shouldShowFloatingGuide({
  documentHeight,
  scrollY,
  viewportHeight,
  wideScreen,
}: FloatingGuideViewport) {
  const hasLeftHero = scrollY > viewportHeight * 0.7;
  const remainingPage = documentHeight - scrollY - viewportHeight;
  return wideScreen && hasLeftHero && remainingPage > 600;
}
