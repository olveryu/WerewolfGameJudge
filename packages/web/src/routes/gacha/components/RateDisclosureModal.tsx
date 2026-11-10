import './RateDisclosureModal.css';

import {
  GOLDEN_RATES,
  NORMAL_RATES,
  PITY_THRESHOLD,
  type Rarity,
  SHARD_VALUES,
} from '@game-judge/game-engine/product/rewards';

import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import { RARITY_VISUAL } from '@/config/rarityVisual';
import IconInformationCircleOutline from '~icons/ion/information-circle-outline';
import IconSparkles from '~icons/ion/sparkles';
import IconStar from '~icons/ion/star';

const COLUMNS: readonly Rarity[] = ['mythic', 'legendary', 'epic', 'rare', 'common'];

/** Ticket count columns of the ticket source table. */
const DRAW_COUNTS = [1, 2, 3, 4, 5] as const;

/** Per-game and daily normal ticket probabilities (%), matching the engine's `rollNormalDraws` weights. */
const NORMAL_DRAW_PROBS = [30, 35, 20, 10, 5] as const;

/** Level-up golden ticket probabilities (%), matching the engine's `rollGoldenDraws` weights. */
const GOLDEN_DRAW_PROBS = [35, 35, 18, 8, 4] as const;

interface RateDisclosureModalProps {
  open: boolean;
  onClose: () => void;
}

function RarityHeaderRow() {
  return (
    <tr>
      <td />
      {COLUMNS.map((rarity) => (
        <th key={rarity} scope="col" style={{ color: RARITY_VISUAL[rarity].color }}>
          {RARITY_VISUAL[rarity].label}
        </th>
      ))}
    </tr>
  );
}

/** The draw rate, shard conversion, ticket source, and pity disclosure. */
export function RateDisclosureModal({ open, onClose }: RateDisclosureModalProps) {
  return (
    <CenterDialog open={open} onClose={onClose} title="概率公示" testId="gacha-rate-modal">
      <div className="rate-modal">
        <table className="rate-table" aria-label="抽奖概率">
          <thead>
            <RarityHeaderRow />
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                <IconSparkles aria-hidden className="rate-row-icon" />
                普通
              </th>
              {COLUMNS.map((rarity) => (
                <td key={rarity}>{NORMAL_RATES[rarity]}%</td>
              ))}
            </tr>
            <tr data-golden="true">
              <th scope="row">
                <IconStar aria-hidden className="rate-row-icon" />
                黄金
              </th>
              {COLUMNS.map((rarity) => (
                <td key={rarity}>{GOLDEN_RATES[rarity]}%</td>
              ))}
            </tr>
          </tbody>
        </table>

        <h3 className="rate-section-title">重复碎片转化</h3>
        <table className="rate-table" aria-label="重复碎片转化">
          <thead>
            <RarityHeaderRow />
          </thead>
          <tbody>
            <tr>
              <th scope="row">碎片</th>
              {COLUMNS.map((rarity) => (
                <td key={rarity}>{SHARD_VALUES[rarity]}</td>
              ))}
            </tr>
          </tbody>
        </table>

        <h3 className="rate-section-title">券获取概率</h3>
        <table className="rate-table" aria-label="券获取概率">
          <thead>
            <tr>
              <td />
              {DRAW_COUNTS.map((count) => (
                <th key={count} scope="col">
                  {count}张
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                <span className="rate-row-label">
                  普通<span className="rate-row-sub">每局/每日</span>
                </span>
              </th>
              {NORMAL_DRAW_PROBS.map((percent, index) => (
                <td key={DRAW_COUNTS[index]}>{percent}%</td>
              ))}
            </tr>
            <tr data-golden="true">
              <th scope="row">
                <span className="rate-row-label">
                  黄金<span className="rate-row-sub">升级获得</span>
                </span>
              </th>
              {GOLDEN_DRAW_PROBS.map((percent, index) => (
                <td key={DRAW_COUNTS[index]}>{percent}%</td>
              ))}
            </tr>
          </tbody>
        </table>

        <h3 className="rate-section-title">规则</h3>
        <p className="rate-rule">
          <IconInformationCircleOutline aria-hidden className="rate-rule-icon" />
          {PITY_THRESHOLD} 次保底：普通抽保底稀有，黄金抽保底史诗
        </p>

        <Button variant="secondary" onClick={onClose}>
          知道了
        </Button>
      </div>
    </CenterDialog>
  );
}
