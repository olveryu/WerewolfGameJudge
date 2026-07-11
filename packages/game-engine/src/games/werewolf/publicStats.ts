/** Public Werewolf statistics contract shared by Worker and client runtimes. */

import { CAMP_ORDER, type CampBucket } from '../../models/roles/camp';

export const WEREWOLF_CAMP_ORDER = CAMP_ORDER;

export interface WerewolfCampStats {
  readonly total: number;
  readonly counts: Readonly<Record<CampBucket, number>>;
}

export interface WerewolfPublicStats {
  readonly gameType: 'werewolf';
  readonly campStats: WerewolfCampStats;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value;
}

function parseCount(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${path} must be a non-negative safe integer`);
  }
  return value;
}

export function parseWerewolfPublicStats(value: unknown): WerewolfPublicStats {
  const stats = parseRecord(value, 'werewolfPublicStats');
  if (stats.gameType !== 'werewolf') {
    throw new Error('werewolfPublicStats.gameType must be werewolf');
  }

  const campStats = parseRecord(stats.campStats, 'werewolfPublicStats.campStats');
  const countsRecord = parseRecord(campStats.counts, 'werewolfPublicStats.campStats.counts');
  const counts: Record<CampBucket, number> = {
    wolf: parseCount(countsRecord.wolf, 'werewolfPublicStats.campStats.counts.wolf'),
    god: parseCount(countsRecord.god, 'werewolfPublicStats.campStats.counts.god'),
    villager: parseCount(countsRecord.villager, 'werewolfPublicStats.campStats.counts.villager'),
    third: parseCount(countsRecord.third, 'werewolfPublicStats.campStats.counts.third'),
  };
  const total = parseCount(campStats.total, 'werewolfPublicStats.campStats.total');
  const countTotal = CAMP_ORDER.reduce((sum, camp) => sum + counts[camp], 0);
  if (countTotal !== total) {
    throw new Error('werewolfPublicStats.campStats.total must equal the camp count sum');
  }

  return { gameType: 'werewolf', campStats: { total, counts } };
}
