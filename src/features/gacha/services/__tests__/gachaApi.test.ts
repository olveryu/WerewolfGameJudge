import { REWARD_POOL } from '@game-judge/game-engine/product/rewards';

import { cfGet, cfPost } from '@/services/cloudflare/cfFetch';

import { claimDailyReward, exchangeShard, fetchGachaStatus, performDraw } from '../gachaApi';

jest.mock('@/services/cloudflare/cfFetch', () => ({ cfGet: jest.fn(), cfPost: jest.fn() }));

const mockCfGet = jest.mocked(cfGet);
const mockCfPost = jest.mocked(cfPost);

function respondToGet(value: unknown): void {
  mockCfGet.mockImplementationOnce(async (_path, decode) => decode(value));
}

function respondToPost(value: unknown): void {
  mockCfPost.mockImplementationOnce(async (_path, _body, decode) => decode(value));
}

describe('gachaApi response contracts', () => {
  beforeEach(() => {
    mockCfGet.mockReset();
    mockCfPost.mockReset();
  });

  it('decodes every gacha response variant', async () => {
    const reward = REWARD_POOL[0];
    if (reward === undefined) throw new Error('Reward catalog must not be empty');

    respondToGet({
      normalDraws: 3,
      goldenDraws: 1,
      normalPity: 2,
      goldenPity: 0,
      shards: 5,
      unlockedCount: 1,
    });
    respondToPost({
      results: [
        {
          rarity: reward.rarity,
          rewardType: reward.type,
          rewardId: reward.id,
          isNew: true,
          isPityTriggered: false,
          isDuplicate: false,
          shardsAwarded: 0,
        },
      ],
      totalShardsAwarded: 0,
      remaining: { normalDraws: 2, goldenDraws: 1 },
    });
    respondToPost({ claimed: false, reason: 'cooldown' });
    respondToPost({
      rewardId: reward.id,
      rewardType: reward.type,
      rarity: reward.rarity,
      cost: 10,
      remainingShards: 5,
    });

    await expect(fetchGachaStatus()).resolves.toMatchObject({ normalDraws: 3 });
    await expect(performDraw('normal')).resolves.toMatchObject({
      results: [{ rewardId: reward.id }],
    });
    await expect(claimDailyReward()).resolves.toEqual({ claimed: false, reason: 'cooldown' });
    await expect(exchangeShard(reward.id)).resolves.toMatchObject({ rewardId: reward.id });
  });

  it('rejects a reward unknown to the active product catalog', async () => {
    respondToPost({
      results: [
        {
          rarity: 'common',
          rewardType: 'avatar',
          rewardId: 'future-reward',
          isNew: true,
          isPityTriggered: false,
          isDuplicate: false,
          shardsAwarded: 0,
        },
      ],
      totalShardsAwarded: 0,
      remaining: { normalDraws: 0, goldenDraws: 0 },
    });

    await expect(performDraw('normal')).rejects.toThrow('registered reward ID');
  });
});
