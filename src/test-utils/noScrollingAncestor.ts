/**
 * Assertions that a typing input lives in the pinned task-frame footer,
 * never inside a scrolling container.
 *
 * `RoomTaskFrame` on its own can only assert its own skeleton has no
 * `ScrollView`; each game fills the body with its own content (a guess
 * log, a previous entry, a prompt), so the no-scrolling-ancestor rule
 * has to be pinned per typing surface, on the real rendered tree.
 */

import { FlatList, ScrollView, View, VirtualizedList } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

function ancestorChain(instance: ReactTestInstance): ReactTestInstance[] {
  const chain: ReactTestInstance[] = [];
  let current: ReactTestInstance | null = instance.parent;
  while (current !== null) {
    chain.push(current);
    current = current.parent;
  }
  return chain;
}

/** Fails when the input sits inside a ScrollView, FlatList, or VirtualizedList. */
export function assertNoScrollingAncestor(input: ReactTestInstance): void {
  const offenders = ancestorChain(input).filter((ancestor) => {
    const type = ancestor.type;
    return type === ScrollView || type === FlatList || type === VirtualizedList;
  });
  expect(offenders).toHaveLength(0);
}

/**
 * True when a style value pins its view (`flexShrink: 0`). Style props
 * arrive as an object, an array of them, or a registered number; the
 * `in` check narrows the object case without any type assertion, so
 * this helper stays inside the repo's no-ordinary-assertion rule.
 */
function hasFlexShrinkZero(style: unknown): boolean {
  if (Array.isArray(style)) {
    return style.some((entry) => hasFlexShrinkZero(entry));
  }
  if (typeof style === 'object' && style !== null && 'flexShrink' in style) {
    return style.flexShrink === 0;
  }
  return false;
}

function isPinnedFooterView(instance: ReactTestInstance): boolean {
  if (instance.type !== View) return false;
  const style: unknown = instance.props.style;
  return hasFlexShrinkZero(style);
}

/**
 * Nearest ancestor View with `flexShrink: 0` — the task-frame footer
 * wrapper. Throws when the input has no such ancestor.
 */
export function getPinnedFooterAncestor(input: ReactTestInstance): ReactTestInstance {
  const footer = ancestorChain(input).find((ancestor) => isPinnedFooterView(ancestor));
  if (footer === undefined) {
    throw new Error('Typing input has no pinned-footer (flexShrink: 0) ancestor');
  }
  return footer;
}

/** Fails unless both nodes share the same pinned-footer ancestor. */
export function assertSharesPinnedFooter(
  input: ReactTestInstance,
  action: ReactTestInstance,
): void {
  const footer = getPinnedFooterAncestor(input);
  expect([action, ...ancestorChain(action)]).toContain(footer);
}

/** Fails when `node` is rendered inside `ancestor`. */
export function assertNotDescendantOf(node: ReactTestInstance, ancestor: ReactTestInstance): void {
  expect([node, ...ancestorChain(node)]).not.toContain(ancestor);
}
