export type InvoiceyPointer = Readonly<{ x: number; y: number }>;

export type InvoiceyPose = Readonly<{
  bodyPositionX: number;
  bodyPositionY: number;
  bodyRotationX: number;
  bodyRotationY: number;
  bodyRotationZ: number;
  bodyScaleX: number;
  bodyScaleY: number;
  shadowOpacity: number;
  shadowScale: number;
}>;

type InvoiceyMotionInput = Readonly<{
  celebrationProgress: number;
  elapsedSeconds: number;
  pointer: InvoiceyPointer;
  scrollProgress: number;
}>;

const CELEBRATION_DURATION_MS = 1_200;

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

function scaleInput(value: number, scale: number) {
  return value === 0 ? 0 : value * scale;
}

export function calculateInvoiceyPose({
  celebrationProgress,
  elapsedSeconds,
  pointer,
  scrollProgress,
}: InvoiceyMotionInput): InvoiceyPose {
  const celebrationArc = Math.sin(celebrationProgress * Math.PI);
  const celebrationWave =
    Math.sin(celebrationProgress * Math.PI * 5) * celebrationArc;
  const idleSway = Math.sin(elapsedSeconds * 0.72);
  const float = Math.sin(elapsedSeconds * 1.25);
  const scroll = clampUnit(scrollProgress);

  return {
    bodyPositionX: pointer.x * 0.07 + idleSway * 0.025,
    bodyPositionY: float * 0.055 + celebrationArc * 0.32 - scroll * 0.12,
    bodyRotationX: scaleInput(pointer.y, -0.09),
    bodyRotationY:
      pointer.x * 0.15 + Math.sin(celebrationProgress * Math.PI * 2) * 0.2,
    bodyRotationZ: idleSway * 0.012 - celebrationWave * 0.035 - scroll * 0.015,
    bodyScaleX: 1 - celebrationArc * 0.025,
    bodyScaleY: 1 + celebrationArc * 0.045,
    shadowOpacity: 0.1 - Math.max(0, float) * 0.018 - celebrationArc * 0.035,
    shadowScale: 1 - Math.max(0, float) * 0.025 - celebrationArc * 0.1,
  };
}

export function resolveCelebrationProgress(
  nowMs: number,
  startedAtMs: number | null,
) {
  if (startedAtMs === null) return 0;

  const progress = (nowMs - startedAtMs) / CELEBRATION_DURATION_MS;
  if (progress < 0 || progress >= 1) return 0;
  return progress;
}
