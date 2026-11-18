import { DEFAULT_STORY_RELAY_CONFIG } from '@game-judge/game-engine/games/storyrelay/public';

import { createStoryRelayRoomSummarySettings } from '../storyRelayRoomAdapter';

describe('createStoryRelayRoomSummarySettings', () => {
  it('includes every public lobby setting', () => {
    expect(createStoryRelayRoomSummarySettings(DEFAULT_STORY_RELAY_CONFIG)).toEqual([
      { label: '总棒数', value: '6 棒' },
      { label: '写作时限', value: '90 秒' },
      { label: '过渡间隔', value: '3 秒' },
      { label: '每段停留', value: '5 秒' },
    ]);
  });

  it('keeps unlimited values distinguishable from manual gallery paging', () => {
    expect(
      createStoryRelayRoomSummarySettings({
        ...DEFAULT_STORY_RELAY_CONFIG,
        writingDurationSeconds: null,
        galleryItemDurationSeconds: null,
      }),
    ).toEqual(
      expect.arrayContaining([
        { label: '写作时限', value: '不限时' },
        { label: '每段停留', value: '手动翻页' },
      ]),
    );
  });
});
