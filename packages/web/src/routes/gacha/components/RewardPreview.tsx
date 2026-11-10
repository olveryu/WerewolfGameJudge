import './RewardPreview.css';

import type { RewardType } from '@game-judge/game-engine/product/rewards';
import type { RefObject } from 'react';

import { Avatar } from '@/components/avatar/Avatar';
import { makeBuiltinAvatarUrl } from '@/components/avatar/avatarSources';
import { IonIcon } from '@/components/icons/IonIcon';
import { NameStyleText } from '@/components/nameStyles/NameStyleText';
import { ResidentAvatarTile } from '@/features/product/components/ResidentPreview';
import type { ClientProductUi } from '@/features/product/model/ClientProductUi';
import {
  cosmeticName,
  FLAIR_NAMES,
  FRAME_NAMES,
  NAME_STYLE_NAMES,
  SEAT_ANIMATION_NAMES,
} from '@/features/product/model/cosmeticNames';
import { type ResidentDecorations, resolveResidentDecorations } from '@/scene/residentDecorations';

/** Built-in previews wear the wolf-paw default, keyed like the previous client. */
const PREVIEW_USER_ID = 'preview';

/** The display name of a drawn reward. */
export function getRewardDisplayName(
  productUi: ClientProductUi,
  rewardType: RewardType,
  rewardId: string,
): string {
  switch (rewardType) {
    case 'avatar':
      return productUi.getAvatarDisplayName(rewardId);
    case 'frame':
      return cosmeticName(FRAME_NAMES, rewardId);
    case 'seatFlair':
      return cosmeticName(FLAIR_NAMES, rewardId);
    case 'nameStyle':
      return cosmeticName(NAME_STYLE_NAMES, rewardId);
    case 'seatAnimation':
      return cosmeticName(SEAT_ANIMATION_NAMES, rewardId);
    case 'roleRevealEffect':
      return productUi.getRevealEffectPresentation(rewardId).label;
  }
}

function residentsOf(
  productUi: ClientProductUi,
  rewardType: RewardType,
  rewardId: string,
): ResidentDecorations | null {
  switch (rewardType) {
    case 'frame':
      return resolveResidentDecorations({ avatarFrame: rewardId });
    case 'seatFlair':
      return resolveResidentDecorations({ seatFlair: rewardId });
    case 'seatAnimation':
      return resolveResidentDecorations({ seatAnimation: rewardId });
    case 'roleRevealEffect':
      return productUi.getRevealEffectPresentation(rewardId).petName === null
        ? null
        : resolveResidentDecorations({ seatPetId: rewardId });
    case 'avatar':
    case 'nameStyle':
      return null;
  }
}

interface RewardPreviewProps {
  rewardType: RewardType;
  rewardId: string;
  /** Edge length in px. */
  size: number;
  productUi: ClientProductUi;
  /** The dialog's {@link ResidentSceneLayer} host, for stage-drawn decorations. */
  sceneHostRef: RefObject<HTMLDivElement | null>;
  scrollRootRef?: RefObject<HTMLElement | null>;
  /** Dims the preview; stage-drawn decorations take it through the scene, not CSS. */
  opacity?: number;
}

/** A square preview of a drawn reward, as it looks when equipped. */
export function RewardPreview({
  rewardType,
  rewardId,
  size,
  productUi,
  sceneHostRef,
  scrollRootRef,
  opacity = 1,
}: RewardPreviewProps) {
  const residents = residentsOf(productUi, rewardType, rewardId);
  const body = (() => {
    if (residents !== null) {
      return (
        <ResidentAvatarTile
          userId={PREVIEW_USER_ID}
          avatarUrl={null}
          residents={residents}
          sceneHostRef={sceneHostRef}
          scrollRootRef={scrollRootRef}
          opacity={opacity}
        />
      );
    }
    switch (rewardType) {
      case 'avatar':
        return <Avatar userId={rewardId} avatarUrl={makeBuiltinAvatarUrl(rewardId)} size="fill" />;
      case 'nameStyle':
        return (
          <span className="reward-preview-surface">
            <NameStyleText styleId={rewardId}>
              {getRewardDisplayName(productUi, rewardType, rewardId)}
            </NameStyleText>
          </span>
        );
      default:
        return (
          <span className="reward-preview-surface reward-preview-icon">
            <IonIcon name={productUi.getRevealEffectPresentation(rewardId).icon} />
          </span>
        );
    }
  })();
  return (
    <span
      className="reward-preview"
      style={{
        '--reward-preview-size': `${size}px`,
        opacity: residents === null ? opacity : undefined,
      }}
    >
      {body}
    </span>
  );
}
