import './GamePickerPage.css';

import { Link, useNavigate, useSearchParams } from 'react-router';

import { gameConfigCreatePath } from '@/features/navigation/model/gamePaths';
import { type ClientGameModeOption, GAME_MODE_OPTIONS } from '@/games/catalog';
import { TESTIDS } from '@/testids';
import IconClose from '~icons/ion/close';

const MAIN_OPTIONS = GAME_MODE_OPTIONS.filter((option) => option.tier === 'main');
const MINI_OPTIONS = GAME_MODE_OPTIONS.filter((option) => option.tier === 'mini');

function readPurpose(value: string | null): 'create' {
  if (value === 'create') return value;
  throw new Error(`Unsupported game picker purpose "${String(value)}"`);
}

function FeaturedGameCard({
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
      className="picker-featured"
      style={{
        backgroundImage: `linear-gradient(135deg, ${option.gradient[0]}, ${option.gradient[1]})`,
      }}
      data-testid={TESTIDS.gameModePickerOption(option.gameType)}
      onClick={onSelect}
    >
      {option.artUrl ? (
        <>
          <img className="picker-featured-art" src={option.artUrl} alt="" decoding="async" />
          <span className="picker-featured-shade" />
        </>
      ) : (
        <Icon className="picker-featured-watermark" aria-hidden />
      )}
      <span className="picker-featured-pill">主游戏</span>
      <span className="picker-featured-text">
        <span className="picker-featured-title">{option.displayName}</span>
        <span className="picker-featured-subtitle">{option.subtitle}</span>
      </span>
    </button>
  );
}

function MiniGameTile({
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
      className="picker-mini"
      data-testid={TESTIDS.gameModePickerOption(option.gameType)}
      onClick={onSelect}
    >
      {option.artUrl ? (
        <img className="picker-mini-art" src={option.artUrl} alt="" decoding="async" />
      ) : (
        <span className="picker-mini-icon" style={{ backgroundColor: option.gradient[1] }}>
          <Icon aria-hidden />
        </span>
      )}
      <span className="picker-mini-text">
        <span className="picker-mini-title">{option.displayName}</span>
        <span className="picker-mini-subtitle">{option.subtitle}</span>
      </span>
    </button>
  );
}

/** Game picker opened from Home: flagship games as featured cards, the rest under 小游戏. */
export function GamePickerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  readPurpose(searchParams.get('purpose'));

  const select = (option: ClientGameModeOption) => {
    void navigate(gameConfigCreatePath(option.gameType));
  };

  return (
    <main className="picker" data-testid={TESTIDS.gameModePickerModal}>
      <header className="picker-header">
        <div>
          <h1 className="picker-title">创建游戏</h1>
          <p className="picker-subtitle">选择本局要创建的游戏</p>
        </div>
        <Link to="/" className="picker-close" aria-label="关闭">
          <IconClose aria-hidden />
        </Link>
      </header>

      <section className="picker-featured-list">
        {MAIN_OPTIONS.map((option) => (
          <FeaturedGameCard key={option.gameType} option={option} onSelect={() => select(option)} />
        ))}
      </section>

      {MINI_OPTIONS.length > 0 && (
        <section>
          <h2 className="picker-section-label" data-testid={TESTIDS.gameModePickerMiniSection}>
            小游戏
          </h2>
          <div className="picker-mini-grid">
            {MINI_OPTIONS.map((option) => (
              <MiniGameTile key={option.gameType} option={option} onSelect={() => select(option)} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
