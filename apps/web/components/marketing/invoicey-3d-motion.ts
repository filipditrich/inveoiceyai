export type InvoiceyPointer = Readonly<{ x: number; y: number }>;

export type InvoiceyPose = Readonly<{
  bodyPositionY: number;
  bodyRotationX: number;
  bodyRotationY: number;
  bodyRotationZ: number;
  bodyScaleX: number;
  bodyScaleY: number;
  eyeX: number;
  eyeY: number;
  eyeScaleY: number;
  leftArmRotationZ: number;
  legSwing: number;
  rightArmRotationZ: number;
  tokenPositionY: number;
  tokenRotationY: number;
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

function resolveBlinkScale(elapsedSeconds: number) {
  const blinkCenter = 3.75;
  const blinkHalfDuration = 0.12;
  const cyclePosition = elapsedSeconds % 5;
  const distanceFromCenter = Math.abs(cyclePosition - blinkCenter);
  if (distanceFromCenter >= blinkHalfDuration) return 1;

  const closure = Math.cos(
    (distanceFromCenter / blinkHalfDuration) * (Math.PI / 2),
  );
  return 1 - closure * 0.9;
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
  const walkingSway = Math.sin(elapsedSeconds * 1.3);

  return {
    bodyPositionY:
      walkingSway * 0.045 +
      celebrationArc * 0.32 -
      clampUnit(scrollProgress) * 0.12,
    bodyRotationX: scaleInput(pointer.y, -0.12),
    bodyRotationY:
      pointer.x * 0.19 + Math.sin(celebrationProgress * Math.PI * 2) * 0.22,
    bodyRotationZ: idleSway * 0.018 - celebrationWave * 0.025,
    bodyScaleX: 1 - celebrationArc * 0.025,
    bodyScaleY: 1 + celebrationArc * 0.045,
    eyeX: scaleInput(pointer.x, 0.04),
    eyeY: scaleInput(pointer.y, -0.03),
    eyeScaleY: Math.min(
      resolveBlinkScale(elapsedSeconds),
      1 - celebrationArc * 0.12,
    ),
    leftArmRotationZ: -idleSway * 0.018 + celebrationArc * 0.12,
    legSwing: walkingSway * 0.025 + celebrationWave * 0.035,
    rightArmRotationZ:
      idleSway * 0.025 - celebrationArc * 0.28 + celebrationWave * 0.09,
    tokenPositionY: Math.sin(elapsedSeconds * 1.9) * 0.035,
    tokenRotationY: pointer.x * 0.12 + Math.sin(elapsedSeconds * 0.75) * 0.12,
    tokenRotationZ:
      Math.sin(elapsedSeconds * 0.6) * 0.025 + celebrationWave * 0.04,
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
