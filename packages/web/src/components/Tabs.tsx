/**
 * The one tabs implementation (Ark UI tabs: roving focus, arrow/Home/End keys, tab ↔ panel ids).
 * `Tabs` holds the value, `TabList` draws the triggers in one of two looks, `TabPanel` is the
 * content of the active tab. Spacing around the list belongs to the caller's layout.
 */
import './Tabs.css';

import { Tabs as ArkTabs, useTabsContext } from '@ark-ui/react/tabs';
import { type ReactNode, useEffect, useRef } from 'react';

/** Accent of an underline tab: a faction, or the primary color when omitted. */
export type TabTone = 'wolf' | 'god' | 'villager' | 'third';

export interface TabItem {
  readonly value: string;
  readonly label: ReactNode;
  /** An icon before the label. */
  readonly icon?: ReactNode;
  /** A trailing element after the label (a count, an unread dot). */
  readonly trailing?: ReactNode;
  readonly tone?: TabTone;
  readonly testId?: string;
}

/**
 * The tabs root. `fill` makes it a column that takes the remaining height of its parent; `lazy`
 * mounts a panel only while its tab is selected (panels that load or fetch on mount);
 * `manualActivation` selects a focused tab only on Enter/Space (tabs whose panel is costly).
 */
export function Tabs({
  value,
  onValueChange,
  fill = false,
  lazy = false,
  manualActivation = false,
  children,
}: {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly fill?: boolean;
  readonly lazy?: boolean;
  readonly manualActivation?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <ArkTabs.Root
      className="tabs"
      data-fill={fill}
      value={value}
      onValueChange={(details) => onValueChange(details.value)}
      lazyMount={lazy}
      unmountOnExit={lazy}
      activationMode={manualActivation ? 'manual' : 'automatic'}
    >
      {children}
    </ArkTabs.Root>
  );
}

/** Scrolls a sideways-scrolling tab list so its selected tab is fully visible. */
function useSelectedTabInView(isScrolling: boolean) {
  const { value } = useTabsContext();
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (!isScrolling || list === null) return;
    const tab = list.querySelector('[role="tab"][aria-selected="true"]');
    if (tab === null) return;
    const listBounds = list.getBoundingClientRect();
    const tabBounds = tab.getBoundingClientRect();
    if (tabBounds.left < listBounds.left) list.scrollLeft += tabBounds.left - listBounds.left;
    if (tabBounds.right > listBounds.right) list.scrollLeft += tabBounds.right - listBounds.right;
  }, [isScrolling, value]);
  return listRef;
}

/**
 * The tab triggers. `segmented`: a pill track whose selected tab is raised (page sections).
 * `underline`: tabs with a bar under the selected one (categories inside a card).
 * `layout`: `fill` shares the row between the tabs; `scroll` keeps each tab at its own width
 * (long names end in an ellipsis) and scrolls the row sideways, keeping the selected tab in view.
 */
export function TabList({
  label,
  variant,
  layout = 'fill',
  items,
}: {
  readonly label: string;
  readonly variant: 'segmented' | 'underline';
  readonly layout?: 'fill' | 'scroll';
  readonly items: readonly TabItem[];
}) {
  const listRef = useSelectedTabInView(layout === 'scroll');
  return (
    <ArkTabs.List
      ref={listRef}
      className="tab-list"
      data-variant={variant}
      data-layout={layout}
      aria-label={label}
    >
      {items.map((item) => (
        <ArkTabs.Trigger
          key={item.value}
          value={item.value}
          className="tab"
          data-tone={item.tone}
          data-testid={item.testId}
        >
          {item.icon}
          <span className="tab-label">{item.label}</span>
          {item.trailing}
        </ArkTabs.Trigger>
      ))}
    </ArkTabs.List>
  );
}

/** The content of one tab; `fill` makes it a column that takes the remaining height. */
export function TabPanel({
  value,
  fill = false,
  testId,
  children,
}: {
  readonly value: string;
  readonly fill?: boolean;
  readonly testId?: string;
  readonly children: ReactNode;
}) {
  return (
    <ArkTabs.Content className="tab-panel" data-fill={fill} value={value} data-testid={testId}>
      {children}
    </ArkTabs.Content>
  );
}
