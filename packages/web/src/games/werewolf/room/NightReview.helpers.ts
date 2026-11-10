/**
 * Night review presentation constants. The fact layer lives in the engine
 * (`getWerewolfNightReview` and its derivations); this module only owns the
 * Chinese labels the report renders.
 */

import type { DeathReason, WerewolfViewModel } from '@game-judge/game-engine/games/werewolf/public';
import { getRoleDisplayName, isValidRoleId } from '@game-judge/game-engine/games/werewolf/public';

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

/**
 * The one check-result naming rule, shared by the in-room reveal title and
 * the night review report: a factionCheck result is already a Chinese
 * faction label and passes through; a roleName result is a role id and is
 * named through the role spec, failing fast on anything else. Both
 * callers pass the entry's carried resultFormat — never sniff the value.
 */
export function formatCheckResultLabel(
  result: string,
  resultFormat: NonNullable<WerewolfViewModel['night']['pendingReveal']>['resultFormat'],
): string {
  if (resultFormat === 'factionCheck') return result;
  if (!isValidRoleId(result)) {
    throw new Error(`[FAIL-FAST] Reveal result ${result} is not a role id`);
  }
  return getRoleDisplayName(result);
}
