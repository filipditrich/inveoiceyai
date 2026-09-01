import type { FlagValue } from "./args";
import type { CompanionClient } from "./client";

export type Ctx = {
  client: CompanionClient;
  json: boolean;
  yes: boolean;
  flags: Record<string, FlagValue>;
};
