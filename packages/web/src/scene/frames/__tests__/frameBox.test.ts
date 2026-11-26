/** The frame's inner edge follows the avatar's own corner, so no avatar corner shows past it. */
import { AVATAR_CORNER_RATIO } from '@/config/avatarShape';

import { frameSvg } from '../frameArt';
import { FRAME_AVATAR_RX, frameUnitsToPx } from '../frameBox';

describe('avatar frame box', () => {
  it.each([56, 88.74, 140])('matches the avatar corner in a %s px frame box', (size) => {
    const avatarSide = frameUnitsToPx(100, size) - frameUnitsToPx(0, size);
    const cornerPx = frameUnitsToPx(FRAME_AVATAR_RX, size) - frameUnitsToPx(0, size);
    expect(cornerPx).toBeCloseTo(AVATAR_CORNER_RATIO * avatarSide, 6);
  });

  it('hands the artwork the same corner at every size', () => {
    const corners: number[] = [];
    const art = frameSvg(({ rx }) => {
      corners.push(rx);
      return '';
    });
    art(56);
    art(140);
    expect(corners).toEqual([FRAME_AVATAR_RX, FRAME_AVATAR_RX]);
  });
});
