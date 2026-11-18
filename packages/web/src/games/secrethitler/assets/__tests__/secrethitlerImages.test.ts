import { describe, expect, it } from 'vitest';

import {
  SECRETHITLER_POLICY_IMAGES,
  secrethitlerPolicyFascistImage,
  secrethitlerPolicyLiberalImage,
} from '../secrethitlerPolicyImages';
import {
  SECRETHITLER_VOTE_IMAGES,
  secrethitlerVoteFailImage,
  secrethitlerVoteNoImage,
  secrethitlerVotePassImage,
  secrethitlerVoteYesImage,
} from '../secrethitlerVoteImages';

describe('Secret Hitler room images', () => {
  it('exposes one image per vote outcome and preloads all four', () => {
    const images = new Set([
      secrethitlerVoteYesImage,
      secrethitlerVoteNoImage,
      secrethitlerVotePassImage,
      secrethitlerVoteFailImage,
    ]);
    expect(images.size).toBe(4);
    for (const image of images) expect(image).toBeTypeOf('string');
    expect(SECRETHITLER_VOTE_IMAGES).toHaveLength(4);
  });

  it('exposes one image per policy and preloads both', () => {
    expect(secrethitlerPolicyLiberalImage).not.toBe(secrethitlerPolicyFascistImage);
    expect(SECRETHITLER_POLICY_IMAGES).toHaveLength(2);
  });
});
