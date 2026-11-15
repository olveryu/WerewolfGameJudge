import './GamePickerPage.css';

import { Link, useNavigate, useSearchParams } from 'react-router';

import { gameConfigCreatePath, gameGuidePath } from '@/features/navigation/model/gamePaths';
import { type ClientGameModeOption, GAME_MODE_OPTIONS } from '@/games/catalog';
import { TESTIDS } from '@/testids';
import IconChevronForward from '~icons/ion/chevron-forward';
import IconClose from '~icons/ion/close';

const MAIN_OPTIONS = GAME_MODE_OPTIONS.filter((option) => option.tier === 'main');
const MINI_OPTIONS = GAME_MODE_OPTIONS.filter((option) => option.tier === 'mini');

type PickerPurpose = 'create' | 'guide';

const PURPOSE_COPY: Record<PickerPurpose, { title: string; subtitle: string }> = {
  create: { title: '创建游戏', subtitle: '选择本局要创建的游戏' },
  guide: { title: '选择游戏图鉴', subtitle: '选择要查看的游戏' },
};

function readPurpose(value: string | null): PickerPurpose {
  if (value === 'create' || value === 'guide') return value;
  throw new Error(`Unsupported game picker purpose "${String(value)}"`);
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
      <span className="picker-option-art" aria-hidden="true">
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

/** Game picker opened from Home, with production games grouped in compact catalog lists. */
export function GamePickerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const purpose = readPurpose(searchParams.get('purpose'));
  const copy = PURPOSE_COPY[purpose];

  const select = (option: ClientGameModeOption) => {
    void navigate(
      purpose === 'create'
        ? gameConfigCreatePath(option.gameType)
        : gameGuidePath(option.gameType, null),
    );
  };

  return (
    <main className="picker" data-testid={TESTIDS.gameModePickerModal}>
      <header className="picker-header">
        <div>
          <h1 className="picker-title">{copy.title}</h1>
          <p className="picker-subtitle">{copy.subtitle}</p>
        </div>
        <Link to="/" className="picker-close" aria-label="关闭">
          <IconClose aria-hidden />
        </Link>
      </header>

      <section className="picker-section">
        <h2 className="picker-section-label">主游戏</h2>
        <div className="picker-option-list">
          {MAIN_OPTIONS.map((option) => (
            <GameOptionRow key={option.gameType} option={option} onSelect={() => select(option)} />
          ))}
        </div>
      </section>

      {MINI_OPTIONS.length > 0 && (
        <section className="picker-section">
          <h2 className="picker-section-label" data-testid={TESTIDS.gameModePickerMiniSection}>
            小游戏
          </h2>
          <div className="picker-option-list">
            {MINI_OPTIONS.map((option) => (
              <GameOptionRow
                key={option.gameType}
                option={option}
                onSelect={() => select(option)}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
