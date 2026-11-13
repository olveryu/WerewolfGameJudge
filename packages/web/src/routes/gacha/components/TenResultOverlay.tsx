import './gachaResult.css';
import './TenResultOverlay.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import type { Rarity } from '@game-judge/game-engine/product/rewards';
import { type CSSProperties, type RefObject, useRef } from 'react';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { RARITY_ORDER, RARITY_VISUAL } from '@/config/rarityVisual';
import type { DrawResultItem } from '@/features/gacha/services/gachaApi';
import { ResidentSceneLayer } from '@/features/product/components/ResidentPreview';
import type { ClientProductUi } from '@/features/product/model/ClientProductUi';
import { withAlpha } from '@/theme/colorUtils';
import IconClose from '~icons/ion/close';
import IconSparkles from '~icons/ion/sparkles';
import IconStar from '~icons/ion/star';

import { GACHA_PALETTE_VARS } from '../gachaPalette';
import { getRewardDisplayName, RewardPreview } from './RewardPreview';

const CELL_PREVIEW_SIZE = 48;
const HIGH_RARITIES: ReadonlySet<Rarity> = new Set(['mythic', 'legendary', 'epic']);

/** Low-rarity cells stagger in one by one; high-rarity cells land together after them. */
const LOW_STAGGER_BASE_MS = 80;
const LOW_STAGGER_STEP_MS = 100;
const HIGH_REVEAL_DELAY_MS = 700;

interface ResultGroup {
  rarity: Rarity;
  items: readonly DrawResultItem[];
  startIndex: number;
}

function groupByRarity(results: readonly DrawResultItem[]): ResultGroup[] {
  const groups: ResultGroup[] = [];
  let startIndex = 0;
  for (const rarity of RARITY_ORDER) {
    const items = results.filter((item) => item.rarity === rarity);
    if (items.length === 0) continue;
    groups.push({ rarity, items, startIndex });
    startIndex += items.length;
  }
  return groups;
}

interface ResultCellProps {
  item: DrawResultItem;
  index: number;
  productUi: ClientProductUi;
  sceneHostRef: RefObject<HTMLDivElement | null>;
  scrollRootRef: RefObject<HTMLDivElement | null>;
}

function ResultCell({ item, index, productUi, sceneHostRef, scrollRootRef }: ResultCellProps) {
  const visual = RARITY_VISUAL[item.rarity];
  const isHigh = HIGH_RARITIES.has(item.rarity);
  const style: CSSProperties = {
    '--cell-delay': `${isHigh ? HIGH_REVEAL_DELAY_MS : LOW_STAGGER_BASE_MS + index * LOW_STAGGER_STEP_MS}ms`,
  };
  if (isHigh) {
    style.borderColor = withAlpha(visual.color, 0.5);
    style.backgroundColor = withAlpha(visual.color, 0.08);
    style.boxShadow = `var(--shadow-sm), 0 0 ${item.rarity === 'legendary' ? 16 : 10}px ${withAlpha(visual.color, 0.25)}`;
  }
  return (
    <li className="ten-result-cell" data-rarity={item.rarity} data-high={isHigh} style={style}>
      {item.isPityTriggered && (
        <span className="ten-result-pity" style={{ color: visual.color }}>
          保底
        </span>
      )}
      <RewardPreview
        rewardType={item.rewardType}
        rewardId={item.rewardId}
        size={CELL_PREVIEW_SIZE}
        productUi={productUi}
        sceneHostRef={sceneHostRef}
        scrollRootRef={scrollRootRef}
      />
      <span className="ten-result-name">
        {getRewardDisplayName(productUi, item.rewardType, item.rewardId)}
      </span>
      <span className="ten-result-rarity" style={{ color: visual.color }}>
        {visual.label}
      </span>
      {item.isDuplicate ? (
        <span className="gacha-shard-award">◆ +{item.shardsAwarded}</span>
      ) : (
        item.isNew && <span className="gacha-new-tag">NEW</span>
      )}
    </li>
  );
}

interface TenResultOverlayProps {
  results: readonly DrawResultItem[];
  drawType: 'normal' | 'golden';
  productUi: ClientProductUi;
  onClose: () => void;
  onGoEquip?: () => void;
}

/** The multi-draw results, grouped by rarity from mythic down, with the duplicate shard total. */
export function TenResultOverlay({
  results,
  drawType,
  productUi,
  onClose,
  onGoEquip,
}: TenResultOverlayProps) {
  const sceneHostRef = useRef<HTMLDivElement>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const groups = groupByRarity(results);
  const totalShards = results.reduce((sum, item) => sum + item.shardsAwarded, 0);
  const isGolden = drawType === 'golden';
  return (
    <Dialog.Root
      open
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
      closeOnInteractOutside={false}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop className="gacha-result-backdrop" />
        <Dialog.Positioner className="gacha-result-positioner" style={GACHA_PALETTE_VARS}>
          <Dialog.Content className="ten-result-card" data-testid="gacha-ten-result">
            <ResidentSceneLayer hostRef={sceneHostRef} />
            <IconButton
              label="关闭"
              icon={<IconClose aria-hidden />}
              className="ten-result-close"
              onClick={onClose}
            />
            <Dialog.Title className="ten-result-title" data-golden={isGolden}>
              {isGolden ? <IconStar aria-hidden /> : <IconSparkles aria-hidden />}
              {isGolden ? `黄金${results.length}连抽结果` : `${results.length}连抽结果`}
            </Dialog.Title>
            <div ref={scrollRootRef} className="ten-result-scroll">
              {groups.map((group) => {
                const visual = RARITY_VISUAL[group.rarity];
                return (
                  <section
                    key={group.rarity}
                    className="ten-result-group"
                    aria-label={`${visual.label} ${group.items.length} 个`}
                  >
                    <div className="ten-result-group-header" aria-hidden>
                      <span
                        className="ten-result-group-dot"
                        style={{ backgroundColor: visual.color }}
                      />
                      <span style={{ color: visual.color }}>{visual.label}</span>
                      <span
                        className="ten-result-group-count"
                        style={{
                          color: visual.color,
                          backgroundColor: withAlpha(visual.color, 0.15),
                        }}
                      >
                        ×{group.items.length}
                      </span>
                    </div>
                    <ul className="ten-result-grid">
                      {group.items.map((item, itemIndex) => (
                        <ResultCell
                          // Duplicates of one reward can land in a single multi-draw.
                          key={`${item.rewardId}-${itemIndex}`}
                          item={item}
                          index={group.startIndex + itemIndex}
                          productUi={productUi}
                          sceneHostRef={sceneHostRef}
                          scrollRootRef={scrollRootRef}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
            {totalShards > 0 && <p className="ten-result-shards">本次获得 ◆ {totalShards} 碎片</p>}
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
