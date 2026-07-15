/** Strict product-presentation resolver composed from game-owned contributions. */

import { AVATAR_IDS, HAND_DRAWN_AVATAR_IDS } from '@werewolf/game-engine/product/rewards';

import type {
  GameProductUiContribution,
  RevealEffectPresentation,
} from '@/features/product/model/GameProductUi';

export interface ClientProductUi {
  readonly getAvatarDisplayName: (avatarId: string) => string;
  readonly getRevealEffectPresentation: (effectId: string) => RevealEffectPresentation;
}

const AVATAR_ID_SET: ReadonlySet<string> = new Set(AVATAR_IDS);
const HAND_DRAWN_AVATAR_ID_SET: ReadonlySet<string> = new Set(HAND_DRAWN_AVATAR_IDS);

function getGeneratedAvatarDisplayName(avatarId: string): string {
  if (!AVATAR_ID_SET.has(avatarId) || HAND_DRAWN_AVATAR_ID_SET.has(avatarId)) {
    throw new Error(`[FAIL-FAST] Unknown generated avatar ${avatarId}`);
  }
  if (avatarId.startsWith('genR')) return `人像 ${avatarId.slice(4)}`;
  if (avatarId.startsWith('genC')) return `色环 ${avatarId.slice(4)}`;
  throw new Error(`[FAIL-FAST] Unsupported generated avatar ${avatarId}`);
}

function resolveSingle<T>(
  contributions: readonly GameProductUiContribution[],
  select: (contribution: GameProductUiContribution) => T | null,
  label: string,
): T {
  const matches = contributions.map(select).filter((value): value is T => value !== null);
  if (matches.length !== 1) {
    throw new Error(`[FAIL-FAST] Expected exactly one product UI owner for ${label}`);
  }
  return matches[0]!;
}

export function createClientProductUi(
  contributions: readonly GameProductUiContribution[],
): ClientProductUi {
  return {
    getAvatarDisplayName: (avatarId) =>
      HAND_DRAWN_AVATAR_ID_SET.has(avatarId)
        ? resolveSingle(
            contributions,
            (contribution) => contribution.getAvatarDisplayName(avatarId),
            `avatar ${avatarId}`,
          )
        : getGeneratedAvatarDisplayName(avatarId),
    getRevealEffectPresentation: (effectId) =>
      resolveSingle(
        contributions,
        (contribution) => contribution.getRevealEffectPresentation(effectId),
        `reveal effect ${effectId}`,
      ),
  };
}
