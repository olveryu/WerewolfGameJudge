/**
 * Night review presentation constants. The fact layer lives in the engine
 * (`getWerewolfNightReview` and its derivations); this module only owns the
 * Chinese labels the report renders.
 */

import type { DeathReason } from '@game-judge/game-engine/games/werewolf/public';

export const DEATH_REASON_LABELS: Record<DeathReason, string> = {
  wolfKill: '狼杀',
  poison: '毒杀',
  checkDeath: '查验致死',
  wolfQueenLink: '魅惑连锁',
  bondedLink: '绑定连锁',
  coupleLink: '殉情',
  dreamcatcherLink: '摄梦连锁',
  reflection: '反伤',
  magicianSwap: '魔术师交换',
};
