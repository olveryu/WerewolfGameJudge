/** Runtime contracts shared by gacha producers, persistence, and consumers. */

import {
  failDecode,
  finishObject,
  parseArray,
  parseBoolean,
  parseInteger,
  parseObject,
  parseString,
} from '../../platform/protocol/runtimeDecoder';
import { RARITIES, type Rarity, REWARD_POOL_BY_ID, REWARD_TYPES, type RewardType } from './catalog';

export interface GachaStatus {
  readonly normalDraws: number;
  readonly goldenDraws: number;
  readonly normalPity: number;
  readonly goldenPity: number;
  readonly shards: number;
  readonly unlockedCount: number;
}

export interface GachaDrawResultItem {
  readonly rarity: Rarity;
  readonly rewardType: RewardType;
  readonly rewardId: string;
  readonly isNew: boolean;
  readonly isPityTriggered: boolean;
  readonly isDuplicate: boolean;
  readonly shardsAwarded: number;
}

export interface GachaDrawResponse {
  readonly results: readonly GachaDrawResultItem[];
  readonly totalShardsAwarded: number;
  readonly remaining: {
    readonly normalDraws: number;
    readonly goldenDraws: number;
  };
}

export type GachaDailyRewardResponse =
  | {
      readonly claimed: true;
      readonly normalDrawsAdded: number;
      readonly goldenDrawsAdded: 1;
    }
  | {
      readonly claimed: false;
      readonly reason: 'cooldown';
    };

export interface GachaExchangeResponse {
  readonly rewardId: string;
  readonly rewardType: RewardType;
  readonly rarity: Rarity;
  readonly cost: number;
  readonly remainingShards: number;
}

function parseNonnegativeInteger(value: unknown, path: string): number {
  const parsed = parseInteger(value, path);
  if (parsed < 0) return failDecode(path, 'a non-negative safe integer');
  return parsed;
}

function parseRarity(value: unknown, path: string): Rarity {
  const parsed = parseString(value, path);
  for (const rarity of RARITIES) {
    if (parsed === rarity) return rarity;
  }
  return failDecode(path, 'a registered reward rarity');
}

function parseRewardType(value: unknown, path: string): RewardType {
  const parsed = parseString(value, path);
  for (const rewardType of REWARD_TYPES) {
    if (parsed === rewardType) return rewardType;
  }
  return failDecode(path, 'a registered reward type');
}

function parseRewardId(value: unknown, path: string): string {
  const parsed = parseString(value, path);
  if (!REWARD_POOL_BY_ID.has(parsed)) return failDecode(path, 'a registered reward ID');
  return parsed;
}

function assertRewardIdentity(
  rewardId: string,
  rarity: Rarity,
  rewardType: RewardType,
  path: string,
): void {
  const reward = REWARD_POOL_BY_ID.get(rewardId);
  if (reward === undefined) {
    throw new Error(`[FAIL-FAST] Registered reward ${rewardId} disappeared from the catalog`);
  }
  if (reward.rarity !== rarity || reward.type !== rewardType) {
    throw new Error(`${path} metadata must match reward ${rewardId}`);
  }
}

function parseDrawResult(value: unknown, path: string): GachaDrawResultItem {
  const raw = parseObject(value, path);
  const parsed = finishObject(
    raw,
    {
      rarity: parseRarity(raw.rarity, `${path}.rarity`),
      rewardType: parseRewardType(raw.rewardType, `${path}.rewardType`),
      rewardId: parseRewardId(raw.rewardId, `${path}.rewardId`),
      isNew: parseBoolean(raw.isNew, `${path}.isNew`),
      isPityTriggered: parseBoolean(raw.isPityTriggered, `${path}.isPityTriggered`),
      isDuplicate: parseBoolean(raw.isDuplicate, `${path}.isDuplicate`),
      shardsAwarded: parseNonnegativeInteger(raw.shardsAwarded, `${path}.shardsAwarded`),
    },
    path,
  );
  if (parsed.isNew === parsed.isDuplicate) {
    throw new Error(`${path}.isNew must be the inverse of isDuplicate`);
  }
  assertRewardIdentity(parsed.rewardId, parsed.rarity, parsed.rewardType, path);
  return parsed;
}

export function parseGachaStatus(value: unknown): GachaStatus {
  const path = 'GachaStatus';
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      normalDraws: parseNonnegativeInteger(raw.normalDraws, `${path}.normalDraws`),
      goldenDraws: parseNonnegativeInteger(raw.goldenDraws, `${path}.goldenDraws`),
      normalPity: parseNonnegativeInteger(raw.normalPity, `${path}.normalPity`),
      goldenPity: parseNonnegativeInteger(raw.goldenPity, `${path}.goldenPity`),
      shards: parseNonnegativeInteger(raw.shards, `${path}.shards`),
      unlockedCount: parseNonnegativeInteger(raw.unlockedCount, `${path}.unlockedCount`),
    },
    path,
  );
}

export function parseGachaDrawResponse(value: unknown): GachaDrawResponse {
  const path = 'GachaDrawResponse';
  const raw = parseObject(value, path);
  const remainingPath = `${path}.remaining`;
  const remainingRaw = parseObject(raw.remaining, remainingPath);
  const results = parseArray(raw.results, `${path}.results`, parseDrawResult);
  if (results.length === 0) return failDecode(`${path}.results`, 'a non-empty array');

  const parsed = finishObject(
    raw,
    {
      results,
      totalShardsAwarded: parseNonnegativeInteger(
        raw.totalShardsAwarded,
        `${path}.totalShardsAwarded`,
      ),
      remaining: finishObject(
        remainingRaw,
        {
          normalDraws: parseNonnegativeInteger(
            remainingRaw.normalDraws,
            `${remainingPath}.normalDraws`,
          ),
          goldenDraws: parseNonnegativeInteger(
            remainingRaw.goldenDraws,
            `${remainingPath}.goldenDraws`,
          ),
        },
        remainingPath,
      ),
    },
    path,
  );
  const calculatedShards = parsed.results.reduce(
    (total, result) => total + result.shardsAwarded,
    0,
  );
  if (parsed.totalShardsAwarded !== calculatedShards) {
    throw new Error(`${path}.totalShardsAwarded must equal the result shard sum`);
  }
  return parsed;
}

export function parseGachaDailyRewardResponse(value: unknown): GachaDailyRewardResponse {
  const path = 'GachaDailyRewardResponse';
  const raw = parseObject(value, path);
  const claimed = parseBoolean(raw.claimed, `${path}.claimed`);
  if (!claimed) {
    if (raw.reason !== 'cooldown') return failDecode(`${path}.reason`, 'cooldown');
    return finishObject(raw, { claimed: false, reason: 'cooldown' }, path);
  }

  const goldenDrawsAdded = parseNonnegativeInteger(
    raw.goldenDrawsAdded,
    `${path}.goldenDrawsAdded`,
  );
  if (goldenDrawsAdded !== 1) return failDecode(`${path}.goldenDrawsAdded`, 'exactly 1');
  return finishObject(
    raw,
    {
      claimed: true,
      normalDrawsAdded: parseNonnegativeInteger(raw.normalDrawsAdded, `${path}.normalDrawsAdded`),
      goldenDrawsAdded,
    },
    path,
  );
}

export function parseGachaExchangeResponse(value: unknown): GachaExchangeResponse {
  const path = 'GachaExchangeResponse';
  const raw = parseObject(value, path);
  const parsed = finishObject(
    raw,
    {
      rewardId: parseRewardId(raw.rewardId, `${path}.rewardId`),
      rewardType: parseRewardType(raw.rewardType, `${path}.rewardType`),
      rarity: parseRarity(raw.rarity, `${path}.rarity`),
      cost: parseNonnegativeInteger(raw.cost, `${path}.cost`),
      remainingShards: parseNonnegativeInteger(raw.remainingShards, `${path}.remainingShards`),
    },
    path,
  );
  assertRewardIdentity(parsed.rewardId, parsed.rarity, parsed.rewardType, path);
  return parsed;
}
