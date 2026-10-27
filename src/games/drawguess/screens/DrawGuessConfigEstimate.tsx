/** Round count and estimated duration derived from the fixed DrawGuess timings. */

import {
  DRAWGUESS_DRAWING_DURATION_SECONDS,
  DRAWGUESS_ROUND_END_SECONDS,
  DRAWGUESS_ROUNDS_PER_DRAWER,
  DRAWGUESS_WORD_SELECT_SECONDS,
  type DrawGuessConfig,
} from '@game-judge/game-engine/games/drawguess/public';
import type React from 'react';
import { Text, View } from 'react-native';

import { gameSettingsStyles as styles } from '@/components/GameSettings.styles';

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

export const DrawGuessConfigEstimate: React.FC<{ readonly config: DrawGuessConfig }> = ({
  config,
}) => (
  <View>
    <Text style={styles.hint}>
      每人画 {DRAWGUESS_ROUNDS_PER_DRAWER} 轮 · 共{' '}
      {config.numberOfPlayers * DRAWGUESS_ROUNDS_PER_DRAWER} 轮
    </Text>
    <Text style={styles.label}>预计时长</Text>
    <Text style={styles.hint}>
      约 {estimateTotalMinutes(config.numberOfPlayers)} 分钟（选词 {DRAWGUESS_WORD_SELECT_SECONDS}{' '}
      秒 + 作画 {DRAWGUESS_DRAWING_DURATION_SECONDS} 秒 + 结算 {DRAWGUESS_ROUND_END_SECONDS}{' '}
      秒）。全员提前猜中或画手放弃会缩短。
    </Text>
  </View>
);
