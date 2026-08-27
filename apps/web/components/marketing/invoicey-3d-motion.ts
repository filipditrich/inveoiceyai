export type InvoiceyPointer = Readonly<{ x: number; y: number }>;

export type InvoiceyPose = Readonly<{
  bodyPositionY: number;
  bodyRotationX: number;
  bodyRotationY: number;
  eyeX: number;
  eyeY: number;
  handLift: number;
  tokenRotationZ: number;
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

  return {
    bodyPositionY:
      Math.sin(elapsedSeconds * 1.3) * 0.06 +
      celebrationArc * 0.32 -
      clampUnit(scrollProgress) * 0.12,
    bodyRotationX: scaleInput(pointer.y, -0.12),
    bodyRotationY:
      pointer.x * 0.22 + Math.sin(celebrationProgress * Math.PI * 2) * 0.28,
    eyeX: scaleInput(pointer.x, 0.04),
    eyeY: scaleInput(pointer.y, -0.03),
    handLift: celebrationArc * 0.45,
    tokenRotationZ: elapsedSeconds * 0.7 + celebrationProgress * Math.PI * 2,
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
