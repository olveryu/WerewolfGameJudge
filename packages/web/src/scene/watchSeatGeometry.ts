/** True while `element` is in the document and rendered (offsets are meaningful). */
function isLaidOut(element: HTMLElement): boolean {
  return element.isConnected && element.offsetParent !== null;
}

/** The nearest ancestor of `element` (or `element` itself) that also contains `host`. */
function commonAncestor(element: HTMLElement, host: HTMLElement): Node {
  let node: Node | null = element;
  while (node !== null && !node.contains(host)) node = node.parentNode;
  return node ?? element.ownerDocument;
}

/**
 * Calls `align` whenever `elements` may have moved or resized relative to the scene `host`:
 *
 * - a resize of any of them or of the host;
 * - a scroll of any container in the document (scroll events do not bubble, and the scroller may
 *   be a sibling of the host, so the listener captures at the document);
 * - a DOM change under their common ancestor: content inserted or removed above a tile moves it
 *   without resizing it, which no resize or scroll reports.
 *
 * Scroll and DOM-change calls are skipped while an element is detached or not rendered. Returns
 * the cleanup. `elements[0]` is the seat tile.
 */
export function watchSeatGeometry(
  elements: readonly [HTMLElement, ...HTMLElement[]],
  host: HTMLElement,
  align: () => void,
): () => void {
  const alignIfLaidOut = () => {
    if (isLaidOut(host) && elements.every(isLaidOut)) align();
  };
  const resizeObserver = new ResizeObserver(align);
  for (const element of elements) resizeObserver.observe(element);
  resizeObserver.observe(host);
  const mutationObserver = new MutationObserver(alignIfLaidOut);
  mutationObserver.observe(commonAncestor(elements[0], host), {
    childList: true,
    characterData: true,
    subtree: true,
  });
  const scrollTarget = host.ownerDocument;
  scrollTarget.addEventListener('scroll', alignIfLaidOut, { capture: true, passive: true });
  return () => {
    resizeObserver.disconnect();
    mutationObserver.disconnect();
    scrollTarget.removeEventListener('scroll', alignIfLaidOut, { capture: true });
  };
}
