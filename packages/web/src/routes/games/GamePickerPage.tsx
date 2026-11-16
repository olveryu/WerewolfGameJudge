import './GamePickerPage.css';

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { ScreenHeader } from '@/components/ScreenHeader';
import { gameConfigCreatePath, gameGuidePath } from '@/features/navigation/model/gamePaths';
import { type ClientGameModeOption, GAME_MODE_OPTIONS } from '@/games/catalog';
import type { GameHomeTier, GameModeFamily } from '@/games/model/GameHome';
import { TESTIDS } from '@/testids';
import IconChevronForward from '~icons/ion/chevron-forward';

const TIER_TABS: readonly { readonly tier: GameHomeTier; readonly label: string }[] = [
  { tier: 'main', label: '主游戏' },
  { tier: 'mini', label: '小游戏' },
];

type PickerPurpose = 'create' | 'guide';

const PURPOSE_COPY: Record<PickerPurpose, { title: string; subtitle: string }> = {
  create: { title: '创建游戏', subtitle: '选择本局要创建的游戏' },
  guide: { title: '选择游戏图鉴', subtitle: '选择要查看的游戏' },
};

function readPurpose(value: string | null): PickerPurpose {
  if (value === 'create' || value === 'guide') return value;
  throw new Error(`Unsupported game picker purpose "${String(value)}"`);
}

/** One render block of a tier tab: a run of lone games, or a family sharing a mechanic. */
type PickerBlock =
  | { readonly kind: 'list'; readonly options: ClientGameModeOption[] }
  | {
      readonly kind: 'family';
      readonly family: GameModeFamily;
      readonly options: ClientGameModeOption[];
    };

/**
 * Splits a tier's options into render blocks, keeping catalog order: a family card opens at
 * its first member's position and later members join it; lone games share one list card
 * until a family card breaks the run.
 */
function groupPickerOptions(options: readonly ClientGameModeOption[]): readonly PickerBlock[] {
  const blocks: PickerBlock[] = [];
  const families = new Map<string, ClientGameModeOption[]>();
  for (const option of options) {
    const family = option.family;
    if (family === undefined) {
      const last = blocks[blocks.length - 1];
      if (last !== undefined && last.kind === 'list') {
        last.options.push(option);
      } else {
        blocks.push({ kind: 'list', options: [option] });
      }
      continue;
    }
    const members = families.get(family.id);
    if (members === undefined) {
      const group: ClientGameModeOption[] = [option];
      families.set(family.id, group);
      blocks.push({ kind: 'family', family, options: group });
    } else {
      members.push(option);
    }
  }
  return blocks;
}

function GameOptionRow({
  option,
  onSelect,
}: {
  option: ClientGameModeOption;
  onSelect: () => void;
}) {
  const { Icon } = option;
  return (
    <button
      type="button"
      className="picker-option"
      data-testid={TESTIDS.gameModePickerOption(option.gameType)}
      onClick={onSelect}
    >
      <span
        className="picker-option-art"
        aria-hidden="true"
        style={
          option.artUrl === undefined
            ? undefined
            : {
                background: `linear-gradient(135deg, ${option.gradient[0]}, ${option.gradient[1]})`,
              }
        }
      >
        {option.artUrl ? (
          <img src={option.artUrl} alt="" decoding="async" />
        ) : (
          <span className="picker-option-icon" style={{ backgroundColor: option.gradient[1] }}>
            <Icon aria-hidden />
          </span>
        )}
      </span>
      <span className="picker-option-copy">
        <span className="picker-option-title">{option.displayName}</span>
        <span className="picker-option-subtitle">{option.subtitle}</span>
      </span>
      <IconChevronForward className="picker-option-chevron" aria-hidden />
    </button>
  );
}

/**
 * Game picker opened from Home. One tab per tier shows all of that tier's games; games
 * sharing a mechanic render as one family card inside their tier.
 */
export function GamePickerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const purpose = readPurpose(searchParams.get('purpose'));
  const copy = PURPOSE_COPY[purpose];
  const [tier, setTier] = useState<GameHomeTier>('main');

  const select = (option: ClientGameModeOption) => {
    void navigate(
      purpose === 'create'
        ? gameConfigCreatePath(option.gameType)
        : gameGuidePath(option.gameType, null),
    );
  };

  const blocks = groupPickerOptions(GAME_MODE_OPTIONS.filter((option) => option.tier === tier));

  return (
    <main className="picker" data-testid={TESTIDS.gameModePickerModal}>
      <ScreenHeader title={copy.title} />
      <div className="picker-body">
        <p className="picker-intro">{copy.subtitle}</p>
        <div className="picker-tabs" role="group" aria-label="游戏分类">
          {TIER_TABS.map(({ tier: tabTier, label }) => (
            <button
              key={tabTier}
              type="button"
              className="picker-tab"
              aria-pressed={tier === tabTier}
              data-testid={TESTIDS.gameModePickerTab(tabTier)}
              onClick={() => setTier(tabTier)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="picker-tab-panel">
          {blocks.map((block) =>
            block.kind === 'family' ? (
              <div
                className="picker-family"
                key={block.family.id}
                data-testid={TESTIDS.gameModePickerFamilyGroup(block.family.id)}
              >
                <div className="picker-family-header">
                  <span className="picker-family-title">{block.family.displayName}</span>
                  <span className="picker-family-count">{`${block.options.length} 个玩法`}</span>
                </div>
                {block.options.map((option) => (
                  <GameOptionRow
                    key={option.gameType}
                    option={option}
                    onSelect={() => select(option)}
                  />
                ))}
              </div>
            ) : (
              <div
                className="picker-option-list"
                key={block.options.map((option) => option.gameType).join('-')}
              >
                {block.options.map((option) => (
                  <GameOptionRow
                    key={option.gameType}
                    option={option}
                    onSelect={() => select(option)}
                  />
                ))}
              </div>
            ),
          )}
        </div>
      </div>
    </main>
  );
}
