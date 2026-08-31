import {
  ACCENT_COLOR_HEX,
  type AppearanceOverride,
  type LegacyAccentColor,
  type LookTheme,
} from "./schema";

export function mergeLookTheme(
  theme: LookTheme,
  appearance: AppearanceOverride | undefined,
): LookTheme {
  if (!appearance) return theme;
  return { ...theme, ...appearance };
}

/** Keep only tokens that differ from the look's theme so a look switch stays clean. */
export function appearanceFromPicker(input: {
  lookTheme: LookTheme;
  accent?: string;
  showStamp?: boolean;
  showSignature?: boolean;
  showQr?: boolean;
  showNotes?: boolean;
}): AppearanceOverride | undefined {
  const appearance: AppearanceOverride = {};
  if (input.accent && input.accent !== input.lookTheme.accent) {
    appearance.accent = input.accent;
  }
  if (
    input.showStamp !== undefined &&
    input.showStamp !== input.lookTheme.showStamp
  ) {
    appearance.showStamp = input.showStamp;
  }
  if (
    input.showSignature !== undefined &&
    input.showSignature !== input.lookTheme.showSignature
  ) {
    appearance.showSignature = input.showSignature;
  }
  if (input.showQr !== undefined && input.showQr !== input.lookTheme.showQr) {
    appearance.showQr = input.showQr;
  }
  if (
    input.showNotes !== undefined &&
    input.showNotes !== input.lookTheme.showNotes
  ) {
    appearance.showNotes = input.showNotes;
  }
  return Object.keys(appearance).length > 0 ? appearance : undefined;
}

export function appearanceFromCustomization(customization: {
  accentColor?: LegacyAccentColor;
  showStamp?: boolean;
  showSignature?: boolean;
}): AppearanceOverride {
  const appearance: AppearanceOverride = {};
  if (customization.accentColor) {
    appearance.accent = ACCENT_COLOR_HEX[customization.accentColor];
  }
  if (customization.showStamp !== undefined) {
    appearance.showStamp = customization.showStamp;
  }
  if (customization.showSignature !== undefined) {
    appearance.showSignature = customization.showSignature;
  }
  return appearance;
}
