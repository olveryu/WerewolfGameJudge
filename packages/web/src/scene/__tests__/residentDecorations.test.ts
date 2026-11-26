import { FRAME_IDS, SEAT_FLAIR_IDS } from '@game-judge/game-engine/product/rewards';
import { describe, expect, it } from 'vitest';

import { resolveResidentDecorations, wearsFrame } from '../residentDecorations';

describe('wearsFrame', () => {
  it('is true only when the decorations include a frame', () => {
    expect(wearsFrame(null)).toBe(false);
    expect(wearsFrame(resolveResidentDecorations({ seatFlair: SEAT_FLAIR_IDS[0] }))).toBe(false);
    expect(wearsFrame(resolveResidentDecorations({ avatarFrame: FRAME_IDS[0] }))).toBe(true);
  });
});
