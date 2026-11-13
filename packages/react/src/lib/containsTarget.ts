import type { RefObject } from 'react';

/** Whether any of `nodes` is, or holds, `target`. */
export function containsTarget(nodes: readonly RefObject<Element | null>[], target: Node): boolean {
  return nodes.some((node) => node.current?.contains(target));
}
