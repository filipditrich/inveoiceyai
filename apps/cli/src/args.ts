export type FlagValue = string | boolean;

export type ParsedArgv = {
  rest: string[];
  flags: Record<string, FlagValue>;
};

const ALIASES: Record<string, string> = {
  y: "yes",
  h: "help",
  v: "version",
  o: "output",
  q: "q",
};

/** Parse GNU-style flags; leftover tokens stay positional. */
export function parseArgv(argv: string[]): ParsedArgv {
  const rest: string[] = [];
  const flags: Record<string, FlagValue> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token == null) continue;
    if (token === "--") {
      rest.push(...argv.slice(i + 1));
      break;
    }
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      if (eq >= 0) {
        flags[token.slice(2, eq)] = token.slice(eq + 1);
        continue;
      }
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next != null && !next.startsWith("-")) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
      continue;
    }
    if (token.startsWith("-") && token.length === 2) {
      const key = ALIASES[token.slice(1)] ?? token.slice(1);
      const next = argv[i + 1];
      if (
        key !== "yes" &&
        key !== "help" &&
        key !== "version" &&
        next != null &&
        !next.startsWith("-")
      ) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
      continue;
    }
    rest.push(token);
  }
  return { rest, flags };
}

export function flagString(
  flags: Record<string, FlagValue>,
  key: string,
): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

export function flagBool(
  flags: Record<string, FlagValue>,
  key: string,
): boolean {
  return flags[key] === true || flags[key] === "true";
}
