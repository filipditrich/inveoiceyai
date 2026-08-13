import { z } from "zod";

const PLACEHOLDER_UUIDS = new Set([
  "00000000-0000-0000-0000-000000000000",
  "ffffffff-ffff-ffff-ffff-ffffffffffff",
]);

/** UUID that is not a model-invented nil / all-f placeholder. */
export const RealUuidSchema = z
  .string()
  .uuid()
  .refine((id) => !PLACEHOLDER_UUIDS.has(id.toLowerCase()), {
    message:
      "placeholder UUID is not allowed; use an id from list_presets or omit the field",
  });
