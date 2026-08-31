import { z } from "zod";

export const LOOK_BLOCKS = [
  "logo",
  "title",
  "issuer",
  "client",
  "lines",
  "totals",
  "tax",
  "payment",
  "qr",
  "stamp",
  "signature",
  "notes",
  "footer",
] as const;

export type LookBlockId = (typeof LOOK_BLOCKS)[number];

export const REQUIRED_LOOK_BLOCKS: readonly LookBlockId[] = [
  "title",
  "issuer",
  "client",
  "lines",
  "totals",
  "tax",
  "footer",
];

export const CLASSIC_LOOK_ID = "classic";
export const MINIMAL_LOOK_ID = "minimal";
export const CLASSIC_LOOK_VERSION = "1.0.0";
export const MINIMAL_LOOK_VERSION = "1.0.0";

export const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "colour must be #RRGGBB");

export const LookSemverSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
    "look version must be semver",
  );

export const LookThemeSchema = z
  .object({
    paper: HexColorSchema,
    ink: HexColorSchema,
    muted: HexColorSchema,
    line: HexColorSchema,
    accent: HexColorSchema,
    typeScale: z.enum(["sm", "md", "lg"]),
    density: z.enum(["comfortable", "compact"]),
    logoMaxHeightPt: z.number().min(24).max(96),
    showStamp: z.boolean(),
    showSignature: z.boolean(),
    showQr: z.boolean(),
    showNotes: z.boolean(),
  })
  .strict();

export type LookTheme = z.infer<typeof LookThemeSchema>;

export const AppearanceOverrideSchema = LookThemeSchema.partial();
export type AppearanceOverride = z.infer<typeof AppearanceOverrideSchema>;

export const BlockInstanceSchema = z
  .object({
    block: z.enum(LOOK_BLOCKS),
    variant: z.enum(["full", "compact"]).optional(),
  })
  .strict();

export type BlockInstance = z.infer<typeof BlockInstanceSchema>;

export const BandSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("stack"),
      slots: z.array(BlockInstanceSchema).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("row"),
      split: z.enum(["1/1", "1/2", "2/1"]).default("1/1"),
      start: z.array(BlockInstanceSchema).min(1),
      end: z.array(BlockInstanceSchema).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("footer"),
      slots: z.tuple([z.object({ block: z.literal("footer") }).strict()]),
    })
    .strict(),
]);

export type LookBand = z.infer<typeof BandSchema>;

export const LookOriginSchema = z.enum([
  "first_party",
  "workspace",
  "community",
]);
export type LookOrigin = z.infer<typeof LookOriginSchema>;

export const LookSlugSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,62}$/, "look id must be a lowercase slug");

export const LookDocumentSchema = z
  .object({
    id: z.string().min(1).max(64),
    version: LookSemverSchema,
    origin: LookOriginSchema,
    name: z.string().min(1).max(80),
    layout: z
      .object({
        bands: z.array(BandSchema).min(1),
      })
      .strict(),
    theme: LookThemeSchema,
  })
  .strict();

export type LookDocument = z.infer<typeof LookDocumentSchema>;

export const LookRefSchema = z.object({
  id: z.string().min(1).max(64),
  version: LookSemverSchema,
});

export type LookRef = z.infer<typeof LookRefSchema>;

export const ACCENT_COLOR_HEX = {
  neutral: "#0a0a0a",
  blue: "#2563eb",
  green: "#16a34a",
  amber: "#d97706",
  rose: "#e11d48",
  violet: "#7c3aed",
} as const;

export type LegacyAccentColor = keyof typeof ACCENT_COLOR_HEX;
