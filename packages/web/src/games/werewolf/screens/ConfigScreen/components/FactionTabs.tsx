/**
 * FactionTabs — the config screen's faction tabs: each shows the faction title + selected count
 * in its faction color. Must render inside the screen's `Tabs`.
 */
import type { Faction } from '@game-judge/game-engine/games/werewolf/public';

import { TabList } from '@/components/Tabs';
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
    <TabList
      label="阵营"
      variant="underline"
      items={tabs.map((tab) => ({
        value: tab.key,
        label: `${tab.title} · ${tab.count}`,
        tone: tab.faction,
        testId: TESTIDS.configFactionTab(tab.key),
      }))}
    />
  );
}
