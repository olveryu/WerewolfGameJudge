import './CosmeticTabs.css';

import type { Rarity } from '@game-judge/game-engine/product/rewards';
import { type KeyboardEvent, useRef } from 'react';

import { RARITY_ORDER, RARITY_VISUAL } from '@/config/rarityVisual';

/** A cosmetic category of the appearance and unlocks pages. */
export type CosmeticTab = 'avatar' | 'frame' | 'flair' | 'nameStyle' | 'effect' | 'seatAnimation';

export type RarityFilter = 'all' | Rarity;

const COSMETIC_TABS: readonly { readonly key: CosmeticTab; readonly label: string }[] = [
  { key: 'avatar', label: '头像' },
  { key: 'frame', label: '框' },
  { key: 'flair', label: '装饰' },
  { key: 'nameStyle', label: '名字' },
  { key: 'effect', label: '特效' },
  { key: 'seatAnimation', label: '入座' },
];

const RARITY_FILTERS: readonly { readonly key: RarityFilter; readonly label: string }[] = [
  { key: 'all', label: '全部' },
  ...RARITY_ORDER.map((rarity) => ({ key: rarity, label: RARITY_VISUAL[rarity].label })),
];

/** The id of a category tab, for the panel's `aria-labelledby`. */
export function cosmeticTabId(idPrefix: string, tab: CosmeticTab): string {
  return `${idPrefix}-tab-${tab}`;
}

interface CosmeticTabBarProps {
  readonly activeTab: CosmeticTab;
  readonly onChange: (tab: CosmeticTab) => void;
  /** Prefix of the tab ids, unique per page. */
  readonly idPrefix: string;
  /** The id of the tab panel the tabs control. */
  readonly panelId: string;
}

/** Category tabs with a roving tab stop (arrow keys, Home and End move between tabs). */
export function CosmeticTabBar({ activeTab, onChange, idPrefix, panelId }: CosmeticTabBarProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const focusTab = (index: number) => {
    const count = COSMETIC_TABS.length;
    const tab = COSMETIC_TABS[(index + count) % count];
    if (tab === undefined) throw new Error(`[FAIL-FAST] No cosmetic tab at ${index}`);
    onChange(tab.key);
    listRef.current?.querySelector<HTMLElement>(`#${cosmeticTabId(idPrefix, tab.key)}`)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = COSMETIC_TABS.findIndex((tab) => tab.key === activeTab);
    const target: Partial<Record<string, number>> = {
      ArrowRight: current + 1,
      ArrowLeft: current - 1,
      Home: 0,
      End: COSMETIC_TABS.length - 1,
    };
    const index = target[event.key];
    if (index === undefined) return;
    event.preventDefault();
    focusTab(index);
  };

  return (
    <div
      ref={listRef}
      className="cosmetic-tabs"
      role="tablist"
      aria-label="外观分类"
      onKeyDown={handleKeyDown}
    >
      {COSMETIC_TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            id={cosmeticTabId(idPrefix, tab.key)}
            type="button"
            role="tab"
            className="cosmetic-tab"
            aria-selected={isActive}
            aria-controls={panelId}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** Rarity chips; the active chip takes its tier's colour. */
export function RarityFilterBar({
  value,
  onChange,
}: {
  readonly value: RarityFilter;
  readonly onChange: (filter: RarityFilter) => void;
}) {
  return (
    <div className="rarity-filters">
      {RARITY_FILTERS.map((filter) => {
        const isActive = filter.key === value;
        const visual = filter.key === 'all' ? null : RARITY_VISUAL[filter.key];
        return (
          <button
            key={filter.key}
            type="button"
            className="rarity-filter"
            aria-pressed={isActive}
            aria-label={`${filter.label}稀有度`}
            style={
              isActive && visual !== null
                ? { backgroundColor: visual.color, boxShadow: visual.chipShadow }
                : undefined
            }
            onClick={() => onChange(filter.key)}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
