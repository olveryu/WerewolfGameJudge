import type React from 'react';

import type { GameAnnouncementTabContentProps } from '@/features/home/model/GameHomeContribution';
import { createClientGameHome } from '@/games/home';
import { createTestClientGameCatalog } from '@/test-utils/clientGameCatalog';

const EmptySpotlight: React.FC = () => null;
const EmptyAnnouncement: React.FC<GameAnnouncementTabContentProps> = () => null;

function createWerewolfModule() {
  const catalog = createTestClientGameCatalog();
  return {
    ...catalog.werewolf,
    home: {
      ...catalog.werewolf.home,
      spotlight: EmptySpotlight,
      announcementTabs: [
        {
          id: 'boards',
          label: '板子',
          Content: EmptyAnnouncement,
        },
      ],
    },
  };
}

describe('createClientGameHome', () => {
  it('aggregates mode, guide, spotlight and namespaced announcement contributions', () => {
    const home = createClientGameHome([createWerewolfModule()]);

    expect(home.modeOptions).toEqual([
      {
        gameType: 'werewolf',
        displayName: '狼人杀',
        subtitle: '经典身份推理',
        iconName: 'moon-outline',
      },
    ]);
    expect(home.guideOptions).toEqual(home.modeOptions);
    expect(home.spotlights).toEqual([{ gameType: 'werewolf', spotlight: EmptySpotlight }]);
    expect(home.announcementTabs).toEqual([
      {
        key: 'werewolf:boards',
        label: '板子',
        Content: EmptyAnnouncement,
      },
    ]);
  });

  it('fails when the catalog is empty', () => {
    expect(() => createClientGameHome([])).toThrow(
      '[FAIL-FAST] Client game catalog must provide at least one Home contribution',
    );
  });

  it('fails when one game contributes duplicate announcement tab ids', () => {
    const module = createWerewolfModule();
    const duplicateModule = {
      ...module,
      home: {
        ...module.home,
        announcementTabs: [...module.home.announcementTabs, ...module.home.announcementTabs],
      },
    };

    expect(() => createClientGameHome([duplicateModule])).toThrow(
      '[FAIL-FAST] Duplicate game announcement tab werewolf:boards',
    );
  });

  it('fails when the same game module is registered twice', () => {
    const module = createWerewolfModule();

    expect(() => createClientGameHome([module, module])).toThrow(
      '[FAIL-FAST] Duplicate Home contribution for werewolf',
    );
  });
});
