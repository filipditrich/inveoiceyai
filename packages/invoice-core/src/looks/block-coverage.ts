import { LOOK_BLOCKS, type LookBlockId } from "./schema";
import type { BlockInstance } from "./schema";

/**
 * Closed block map (ADR 0049 §3). Both interpreters must implement every
 * `LookBlockId`; a missing key is a type error, not a runtime surprise.
 */
export type LookBlockHandler<TCtx, TNode> = (
  ctx: TCtx,
  slot: BlockInstance,
) => TNode | null;

export type LookBlockHandlers<TCtx, TNode> = {
  readonly [K in LookBlockId]: LookBlockHandler<TCtx, TNode>;
};

export function lookBlockHandlerIds<TCtx, TNode>(
  handlers: LookBlockHandlers<TCtx, TNode>,
): readonly LookBlockId[] {
  return LOOK_BLOCKS.filter((id) => handlers[id] !== undefined);
}
