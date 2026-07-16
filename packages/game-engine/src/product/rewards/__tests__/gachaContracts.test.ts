import {
  parseGachaDailyRewardResponse,
  parseGachaDrawResponse,
  parseGachaExchangeResponse,
  parseGachaStatus,
  REWARD_POOL,
} from '../index';

const reward = REWARD_POOL[0];
if (reward === undefined) throw new Error('Reward catalog must not be empty');

const drawResponse = {
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
};

describe('gacha runtime contracts', () => {
  it('decodes every canonical response shape', () => {
    expect(
      parseGachaStatus({
        normalDraws: 2,
        goldenDraws: 1,
        normalPity: 0,
        goldenPity: 0,
        shards: 5,
        unlockedCount: 1,
      }),
    ).toMatchObject({ normalDraws: 2, shards: 5 });
    expect(parseGachaDrawResponse(drawResponse)).toEqual(drawResponse);
    expect(
      parseGachaDailyRewardResponse({
        claimed: true,
        normalDrawsAdded: 3,
        goldenDrawsAdded: 1,
      }),
    ).toEqual({ claimed: true, normalDrawsAdded: 3, goldenDrawsAdded: 1 });
    expect(parseGachaDailyRewardResponse({ claimed: false, reason: 'cooldown' })).toEqual({
      claimed: false,
      reason: 'cooldown',
    });
    expect(
      parseGachaExchangeResponse({
        rewardId: reward.id,
        rewardType: reward.type,
        rarity: reward.rarity,
        cost: 10,
        remainingShards: 5,
      }),
    ).toMatchObject({ rewardId: reward.id });
  });

  it.each([
    { ...drawResponse, compatibility: true },
    { ...drawResponse, totalShardsAwarded: 1 },
    {
      ...drawResponse,
      results: [{ ...drawResponse.results[0], isNew: true, isDuplicate: true }],
    },
    {
      ...drawResponse,
      results: [{ ...drawResponse.results[0], rewardType: 'not-a-reward-type' }],
    },
  ])('rejects a draw response that violates the shared contract', (value) => {
    expect(() => parseGachaDrawResponse(value)).toThrow();
  });

  it('rejects undeclared daily-reward variants', () => {
    expect(() =>
      parseGachaDailyRewardResponse({ claimed: false, reason: 'legacy-cooldown' }),
    ).toThrow();
  });
});
