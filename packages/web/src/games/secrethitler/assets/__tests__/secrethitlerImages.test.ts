import { describe, expect, it } from 'vitest';

import {
  SECRETHITLER_POLICY_IMAGES,
  secrethitlerPolicyFascistImage,
  secrethitlerPolicyLiberalImage,
} from '../secrethitlerPolicyImages';
import {
  SECRETHITLER_VOTE_IMAGES,
  secrethitlerVoteNoImage,
  secrethitlerVoteYesImage,
} from '../secrethitlerVoteImages';

describe('Secret Hitler room images', () => {
  it('exposes and preloads both voting choices', () => {
    const images = new Set([secrethitlerVoteYesImage, secrethitlerVoteNoImage]);
    expect(images.size).toBe(2);
    for (const image of images) expect(image).toBeTypeOf('string');
    expect(SECRETHITLER_VOTE_IMAGES).toHaveLength(2);
  });

  it('exposes one image per policy and preloads both', () => {
    expect(secrethitlerPolicyLiberalImage).not.toBe(secrethitlerPolicyFascistImage);
    expect(SECRETHITLER_POLICY_IMAGES).toHaveLength(2);
  });
});
