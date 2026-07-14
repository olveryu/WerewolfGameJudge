/** Product UI contracts implemented by concrete game modules. */

import type Ionicons from '@expo/vector-icons/Ionicons';
import type { RoleRevealEffectId } from '@werewolf/game-engine/growth/rewardCatalog';
import type React from 'react';

export type RevealEffectSelectionId = RoleRevealEffectId | 'none' | 'random';
export type ProductIconName = React.ComponentProps<typeof Ionicons>['name'];

export interface RevealEffectPreviewProps {
  readonly effectId: RoleRevealEffectId;
  readonly onComplete: () => void;
}

export interface RevealEffectPresentation {
  readonly id: RevealEffectSelectionId;
  readonly label: string;
  readonly icon: ProductIconName;
  readonly shortDescription: string;
  readonly Preview: React.ComponentType<RevealEffectPreviewProps>;
}

export interface GameProductUiContribution {
  getAvatarDisplayName(avatarId: string): string | null;
  getRevealEffectPresentation(effectId: string): RevealEffectPresentation | null;
}
