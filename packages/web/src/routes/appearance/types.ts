/** Appearance page model types. */
import type {
  FlairId,
  FrameId,
  NameStyleId,
  Rarity,
  SeatAnimationId,
} from '@game-judge/game-engine/product/rewards';

import type { IoniconName } from '@/components/icons/IonIcon';
import type { RevealEffectSelectionId } from '@/features/product/model/GameProductUi';

/** A draft choice: an item id, `none`, or (for avatars) `default` / `custom`; null = unchanged. */
export type Selection = string | null;

export type AvatarCellItem =
  | { readonly key: string; readonly type: 'default' }
  | { readonly key: string; readonly type: 'custom' }
  | { readonly key: string; readonly type: 'avatar'; readonly avatarId: string };

/** One cell of a cosmetic picker grid. */
export interface CosmeticGridItem<Id extends string> {
  readonly id: Id;
  readonly name: string;
  readonly unlocked: boolean;
  /** The user's equipped item. */
  readonly isActive: boolean;
  /** Null for the `none` / `random` choices. */
  readonly rarity: Rarity | null;
}

export type FrameGridItem = CosmeticGridItem<FrameId | 'none'>;
export type FlairGridItem = CosmeticGridItem<FlairId | 'none'>;
export type NameStyleGridItem = CosmeticGridItem<NameStyleId | 'none'>;
export type SeatAnimationGridItem = CosmeticGridItem<SeatAnimationId | 'none'>;

export interface EffectGridItem extends CosmeticGridItem<RevealEffectSelectionId> {
  readonly icon: IoniconName;
}
