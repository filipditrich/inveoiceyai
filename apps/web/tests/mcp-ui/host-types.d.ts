import type { CallToolRequest, ResourceLink } from "@modelcontextprotocol/sdk/types.js";
declare global {
  interface Window {
    calls: CallToolRequest["params"][];
    attachedContext?: { content: ResourceLink[] };
    lastMessage?: object;
  }
}
