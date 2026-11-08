/** Story Relay gallery playback defaults: 5 seconds per segment unless the host changes it. */

import {
  DEFAULT_STORY_RELAY_CONFIG,
  isValidStoryRelayConfig,
  STORY_RELAY_GALLERY_DURATIONS,
} from '../state/types';

describe('Story Relay gallery defaults', () => {
  it('offers 5 seconds and defaults to it', () => {
    expect(STORY_RELAY_GALLERY_DURATIONS).toContain(5);
    expect(DEFAULT_STORY_RELAY_CONFIG.galleryItemDurationSeconds).toBe(5);
  });

  it('accepts 5 seconds and rejects an off-list duration', () => {
    expect(
      isValidStoryRelayConfig({ ...DEFAULT_STORY_RELAY_CONFIG, galleryItemDurationSeconds: 5 }),
    ).toBe(true);
    const offList = {
      ...DEFAULT_STORY_RELAY_CONFIG,
      galleryItemDurationSeconds: 7,
    } as unknown as typeof DEFAULT_STORY_RELAY_CONFIG;
    expect(isValidStoryRelayConfig(offList)).toBe(false);
  });
});
