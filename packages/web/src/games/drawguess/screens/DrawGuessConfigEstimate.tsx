/** Round count and estimated duration derived from the fixed DrawGuess timings. */

import '@/components/GameSettings.css';

import {
  DRAWGUESS_DRAWING_DURATION_SECONDS,
  DRAWGUESS_ROUND_END_SECONDS,
  DRAWGUESS_ROUNDS_PER_DRAWER,
  DRAWGUESS_WORD_SELECT_SECONDS,
  type DrawGuessConfig,
} from '@game-judge/game-engine/games/drawguess/public';

const SECONDS_PER_MINUTE = 60;

/** 单轮固定耗时：选词 + 作画 + 结算；总轮数 = 人数 × 每人轮数。 */
function estimateTotalMinutes(numberOfPlayers: number): number {
  const secondsPerTurn =
    DRAWGUESS_WORD_SELECT_SECONDS +
    DRAWGUESS_DRAWING_DURATION_SECONDS +
    DRAWGUESS_ROUND_END_SECONDS;
  return Math.round(
    (numberOfPlayers * DRAWGUESS_ROUNDS_PER_DRAWER * secondsPerTurn) / SECONDS_PER_MINUTE,
  );
}

/** Config-screen footer block: total rounds and the estimated game length. */
export function DrawGuessConfigEstimate({ config }: { readonly config: DrawGuessConfig }) {
  return (
    <div className="game-settings-section">
      <p className="game-settings-hint">
        每人画 {DRAWGUESS_ROUNDS_PER_DRAWER} 轮 · 共{' '}
        {config.numberOfPlayers * DRAWGUESS_ROUNDS_PER_DRAWER} 轮
      </p>
      <span className="game-settings-label">预计时长</span>
      <p className="game-settings-hint">
        约 {estimateTotalMinutes(config.numberOfPlayers)} 分钟（选词 {DRAWGUESS_WORD_SELECT_SECONDS}{' '}
        秒 + 作画 {DRAWGUESS_DRAWING_DURATION_SECONDS} 秒 + 结算 {DRAWGUESS_ROUND_END_SECONDS}{' '}
        秒）。提前选词会缩短选词等待；作画按倒计时结束。
      </p>
    </div>
  );
}
