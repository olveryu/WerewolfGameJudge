/** Product UI contracts implemented by concrete game modules. */
import type { RoleRevealEffectId } from '@game-judge/game-engine/product/rewards';
import type { ComponentType } from 'react';

import type { IoniconName } from '@/components/icons/IonIcon';

export type RevealEffectSelectionId = RoleRevealEffectId | 'none' | 'random';

export interface RevealEffectPreviewProps {
  readonly effectId: RoleRevealEffectId;
  /** Called once the effect has played (or the viewer dismissed it). */
  readonly onComplete: () => void;
}

export interface RevealEffectPresentation {
  readonly id: RevealEffectSelectionId;
  readonly label: string;
  readonly icon: IoniconName;
  readonly shortDescription: string;
  /** The seat companion an equipped effect brings; `none` and `random` have none. */
  readonly petName: string | null;
  /** Plays the effect full screen. */
  readonly Preview: ComponentType<RevealEffectPreviewProps>;
}

/** What one game contributes; `null` means the id is not this game's. */
export interface GameProductUiContribution {
  getAvatarDisplayName(avatarId: string): string | null;
  getRevealEffectPresentation(effectId: string): RevealEffectPresentation | null;
}
