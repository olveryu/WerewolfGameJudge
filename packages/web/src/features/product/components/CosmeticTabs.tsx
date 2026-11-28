import './CosmeticTabs.css';

import type { Rarity } from '@game-judge/game-engine/product/rewards';

import { Chip } from '@/components/Chip';
import { TabList } from '@/components/Tabs';
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

/** The category a tab value names; tab values only ever come from `CosmeticTabList`. */
export function parseCosmeticTab(value: string): CosmeticTab {
  const tab = COSMETIC_TABS.find((item) => item.key === value);
  if (tab === undefined) throw new Error(`[FAIL-FAST] Unknown cosmetic tab: ${value}`);
  return tab.key;
}

/** Category tabs; render inside a `Tabs` whose value is the active `CosmeticTab`. */
export function CosmeticTabList() {
  return (
    <TabList
      label="外观分类"
      variant="segmented"
      items={COSMETIC_TABS.map((tab) => ({ value: tab.key, label: tab.label }))}
    />
  );
}

/** Rarity chips: they share the row when they fit and scroll sideways when not. */
export function RarityFilterBar({
  value,
  onChange,
}: {
  readonly value: RarityFilter;
  readonly onChange: (filter: RarityFilter) => void;
}) {
  return (
    <div className="rarity-filters" role="group" aria-label="稀有度筛选">
      {RARITY_FILTERS.map((filter) => (
        <Chip
          key={filter.key}
          pressed={filter.key === value}
          aria-label={`${filter.label}稀有度`}
          onClick={() => onChange(filter.key)}
        >
          {filter.label}
        </Chip>
      ))}
    </div>
  );
}
