import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function jsonToolResult<T extends object>(payload: T, isError = false) {
  const structuredContent = Array.isArray(payload)
    ? { result: payload }
    : payload;
  const result = {
    content: [
      { type: "text" as const, text: JSON.stringify(structuredContent) },
    ],
    // SAFETY: payloads originate from typed tool handlers; arrays are wrapped to meet the MCP object contract.
    structuredContent: structuredContent as NonNullable<
      CallToolResult["structuredContent"]
    >,
    isError: isError || undefined,
  };
  return result;
}
