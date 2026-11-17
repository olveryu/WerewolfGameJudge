import {
  AVALON_VOTE_IMAGES,
  avalonVoteApproveImage,
  avalonVoteFailImage,
  avalonVoteRejectImage,
  avalonVoteSuccessImage,
} from '../avalonVoteImages';

describe('Avalon vote images', () => {
  it('preloads all four vote/quest illustrations, once each', () => {
    expect(AVALON_VOTE_IMAGES).toEqual([
      avalonVoteApproveImage,
      avalonVoteRejectImage,
      avalonVoteSuccessImage,
      avalonVoteFailImage,
    ]);
    expect(new Set(AVALON_VOTE_IMAGES).size).toBe(AVALON_VOTE_IMAGES.length);
  });

  it('resolves every illustration to a bundled webp asset', () => {
    for (const url of AVALON_VOTE_IMAGES) {
      expect(url).toMatch(/\.webp$/);
    }
  });
});
