/**
 * FactionTabs — faction segmented tab list (Ark UI tabs).
 *
 * Each tab shows the faction title + selected count in its faction color; the selected tab gets
 * a faction tint. Must render inside the screen's `Tabs.Root`.
 */
import { Tabs } from '@ark-ui/react/tabs';
import type { Faction } from '@game-judge/game-engine/games/werewolf/public';

import type { FactionColorKey } from '@/games/werewolf/screens/ConfigScreen/configHelpers';
import { TESTIDS } from '@/testids';

export interface FactionTabItem {
  readonly key: Faction;
  readonly title: string;
  readonly count: number;
  readonly faction: FactionColorKey;
}

export function FactionTabs({ tabs }: { readonly tabs: readonly FactionTabItem[] }) {
  return (
    <Tabs.List className="config-faction-tabs" aria-label="阵营">
      {tabs.map((tab) => (
        <Tabs.Trigger
          key={tab.key}
          value={tab.key}
          className="config-faction-tab"
          data-faction={tab.faction}
          data-testid={TESTIDS.configFactionTab(tab.key)}
        >
          {tab.title} · {tab.count}
        </Tabs.Trigger>
      ))}
    </Tabs.List>
  );
}
