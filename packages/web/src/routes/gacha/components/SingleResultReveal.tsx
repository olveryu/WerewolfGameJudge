import './gachaResult.css';
import './SingleResultReveal.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import type { Rarity, RewardType } from '@game-judge/game-engine/product/rewards';
import { useRef } from 'react';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { RARITY_VISUAL } from '@/config/rarityVisual';
import type { DrawResultItem } from '@/features/gacha/services/gachaApi';
import { ResidentSceneLayer } from '@/features/product/components/ResidentPreview';
import type { ClientProductUi } from '@/features/product/model/ClientProductUi';
import { withAlpha } from '@/theme/colorUtils';
import IconClose from '~icons/ion/close';

import { GACHA_PALETTE_VARS } from '../gachaPalette';
import { getRewardDisplayName, RewardPreview } from './RewardPreview';

const PREVIEW_SIZES: Readonly<Record<Rarity, number>> = {
  mythic: 140,
  common: 80,
  rare: 100,
  epic: 120,
  legendary: 140,
};

const BORDER_WIDTHS: Readonly<Record<Rarity, number>> = {
  mythic: 3,
  common: 1,
  rare: 2,
  epic: 2,
  legendary: 3,
};

/** The card's outer glow: blur radius and colour alpha; common has none. */
const CARD_GLOWS: Readonly<Record<Rarity, { blur: number; alpha: number } | null>> = {
  mythic: { blur: 24, alpha: 0.3 },
  common: null,
  rare: { blur: 16, alpha: 0.2 },
  epic: { blur: 24, alpha: 0.3 },
  legendary: { blur: 40, alpha: 0.3 },
};

const REWARD_TYPE_LABELS: Readonly<Record<RewardType, string>> = {
  avatar: '头像',
  frame: '头像框',
  seatFlair: '座位装饰',
  seatAnimation: '入座动画',
  nameStyle: '名称样式',
  roleRevealEffect: '翻牌特效',
};

interface SingleResultRevealProps {
  item: DrawResultItem;
  productUi: ClientProductUi;
  onDismiss: () => void;
  onGoEquip?: () => void;
  reducedMotion: boolean;
}

/** The single-draw result card; its entrance and glow scale with rarity. */
export function SingleResultReveal({
  item,
  productUi,
  onDismiss,
  onGoEquip,
  reducedMotion,
}: SingleResultRevealProps) {
  const sceneHostRef = useRef<HTMLDivElement>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const { rarity } = item;
  const visual = RARITY_VISUAL[rarity];
  const glow = CARD_GLOWS[rarity];
  const isTopTier = rarity === 'legendary' || rarity === 'mythic';
  return (
    <Dialog.Root
      open
      onOpenChange={(details) => {
        if (!details.open) onDismiss();
      }}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop className="gacha-result-backdrop" />
        <Dialog.Positioner
          className="gacha-result-positioner"
          data-rarity={rarity}
          data-reduced-motion={reducedMotion}
          style={{
            ...GACHA_PALETTE_VARS,
            '--rarity-color': visual.color,
            '--rarity-glow': withAlpha(visual.color, 0.15),
          }}
        >
          {rarity !== 'common' && <span className="single-reveal-glow" aria-hidden />}
          {isTopTier && <span className="single-reveal-pillar" aria-hidden />}
          <Dialog.Content
            className="single-reveal-card"
            data-testid="gacha-single-result"
            style={{
              borderWidth: BORDER_WIDTHS[rarity],
              boxShadow:
                glow === null
                  ? undefined
                  : `var(--shadow-lg), 0 0 ${glow.blur}px ${withAlpha(visual.color, glow.alpha)}`,
            }}
          >
            <ResidentSceneLayer hostRef={sceneHostRef} />
            <IconButton
              label="关闭"
              icon={<IconClose aria-hidden />}
              className="single-reveal-close"
              onClick={onDismiss}
            />
            <div ref={scrollRootRef} className="single-reveal-body">
              <span className="single-reveal-badge" data-top-tier={isTopTier}>
                {visual.label}
              </span>
              {item.isPityTriggered && <span className="single-reveal-pity">保底</span>}
              <span className="single-reveal-preview">
                <RewardPreview
                  rewardType={item.rewardType}
                  rewardId={item.rewardId}
                  size={PREVIEW_SIZES[rarity]}
                  productUi={productUi}
                  sceneHostRef={sceneHostRef}
                  scrollRootRef={scrollRootRef}
                />
              </span>
              <Dialog.Title className="single-reveal-name">
                {getRewardDisplayName(productUi, item.rewardType, item.rewardId)}
              </Dialog.Title>
              <Dialog.Description className="single-reveal-type">
                {REWARD_TYPE_LABELS[item.rewardType]}
              </Dialog.Description>
              {item.isDuplicate ? (
                <span className="single-reveal-duplicate">
                  <span className="single-reveal-owned">已拥有</span>
                  <span className="gacha-shard-award">◆ +{item.shardsAwarded}</span>
                </span>
              ) : (
                item.isNew && <span className="gacha-new-tag">NEW</span>
              )}
            </div>
            {onGoEquip && (
              <Button className="gacha-equip-button" onClick={onGoEquip}>
                去装扮
              </Button>
            )}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
