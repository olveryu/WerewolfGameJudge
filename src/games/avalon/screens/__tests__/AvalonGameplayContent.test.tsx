/**
 * Avalon gameplay copy contract: every number in the guide comes from the
 * engine constants and board data that decide it. The board description is
 * recomputed here from AVALON_BOARDS independently of the component's
 * helper, so a helper bug fails the test.
 */

import {
  AVALON_BOARDS,
  AVALON_DEFAULT_VETO_LIMIT,
  AVALON_DOUBLE_FAIL_QUEST_ROUND,
  AVALON_DOUBLE_FAILS_NEEDED,
  AVALON_FOURTH_QUEST_DOUBLE_FAIL_MIN_PLAYERS,
  AVALON_LADY_MIN_PLAYERS,
  AVALON_LADY_ROUNDS,
  AVALON_MAX_PLAYERS,
  AVALON_MIN_PLAYERS,
  AVALON_PLAYER_COUNTS,
  AVALON_QUEST_COUNT,
  AVALON_QUESTS_TO_WIN,
  AVALON_ROLES,
  AVALON_VETO_LIMIT_MAX,
  AVALON_VETO_LIMIT_MIN,
  type AvalonRoleId,
  isAvalonEvilRole,
} from '@game-judge/game-engine/games/avalon/public';
import { SETTLE_COUNTDOWN_MS } from '@game-judge/game-engine/platform/room/settleCountdown';
import { render } from '@testing-library/react-native';

import { getAvalonRoleDisplayName } from '../../model/avalonRoleDisplay';
import { AvalonGameplayContent } from '../AvalonGameplayContent';

function expectedBoardDescription(): string {
  const countRole = (roles: readonly AvalonRoleId[], role: AvalonRoleId): number =>
    roles.filter((candidate) => candidate === role).length;
  const formatRole = (role: AvalonRoleId, count: number): string => {
    const name = getAvalonRoleDisplayName(role);
    return role === 'loyalServant' || count > 1 ? `${name} ×${count}` : name;
  };
  const parts: string[] = [];
  let base: readonly AvalonRoleId[] | null = null;
  for (const playerCount of AVALON_PLAYER_COUNTS) {
    const roles = AVALON_BOARDS[playerCount];
    if (base === null) {
      base = roles;
      const seen: AvalonRoleId[] = [];
      for (const role of roles) {
        if (!seen.includes(role)) seen.push(role);
      }
      const side = (evil: boolean): string =>
        seen
          .filter((role) => isAvalonEvilRole(role) === evil)
          .map((role) => formatRole(role, countRole(roles, role)))
          .join('、');
      parts.push(`${playerCount} 人：${side(false)} vs ${side(true)}`);
    } else {
      const baseRoles: readonly AvalonRoleId[] = base;
      const loyal = `忠臣 ×${countRole(roles, 'loyalServant')}`;
      const extras = AVALON_ROLES.filter(
        (role) => !baseRoles.includes(role) && roles.includes(role),
      ).map((role) => getAvalonRoleDisplayName(role));
      if (extras.length === 0) parts.push(`${playerCount} 人：${loyal}`);
      else if (extras.length === 1)
        parts.push(`${playerCount} 人：${loyal}，加${extras.join('、')}`);
      else parts.push(`${playerCount} 人：${loyal}，${extras.join('与')}全上`);
    }
  }
  return `${parts.join('；')}。`;
}

describe('AvalonGameplayContent', () => {
  it('renders quest, vote, board, and lady numbers from the engine constants', () => {
    const view = render(<AvalonGameplayContent />);
    const settleSeconds = SETTLE_COUNTDOWN_MS / 1000;
    expect(
      view.getByText(
        `${AVALON_MIN_PLAYERS}–${AVALON_MAX_PLAYERS} 人身份推理：好人阵营轮流组队执行 ${AVALON_QUEST_COUNT} 轮任务，先拿下 ${AVALON_QUESTS_TO_WIN} 个任务获胜；坏人混在队伍里出失败牌破坏任务，连续否决组队或终局刺杀梅林也能获胜。`,
      ),
    ).toBeVisible();
    expect(
      view.getByText(
        `全员对队伍投票，可改票。全员投完武装 ${settleSeconds} 秒倒计时、到期自动结算：赞成多于反对则通过，否则否决（含平票）；单轮连续否决达到上限（建房时设置，${AVALON_VETO_LIMIT_MIN}–${AVALON_VETO_LIMIT_MAX}，默认 ${AVALON_DEFAULT_VETO_LIMIT}），坏人直接获胜。公投模式同时亮票，暗投模式只公布赞成 / 反对数量。`,
      ),
    ).toBeVisible();
    expect(
      view.getByText(
        `队员秘密出牌：好人只能出成功，坏人可出成功或失败。出完可改牌；全员出完武装 ${settleSeconds} 秒倒计时、到期自动结算，洗混亮牌，只公布成功 / 失败数量，不揭晓出牌人。${AVALON_FOURTH_QUEST_DOUBLE_FAIL_MIN_PLAYERS} 人及以上第 ${AVALON_DOUBLE_FAIL_QUEST_ROUND} 轮需要 ${AVALON_DOUBLE_FAILS_NEEDED} 张失败牌才算失败。`,
      ),
    ).toBeVisible();
    expect(view.getByText(`${AVALON_PLAYER_COUNTS.length} 张固定板子`)).toBeVisible();
    expect(view.getByText(expectedBoardDescription())).toBeVisible();
    expect(
      view.getByText(`湖中仙女（${AVALON_LADY_MIN_PLAYERS} / ${AVALON_MAX_PLAYERS} 人局）`),
    ).toBeVisible();
    expect(
      view.getByText(
        `开局 token 给首任组队者右手边的玩家。第 ${AVALON_LADY_ROUNDS.join('、')} 轮任务结算后，持有人私下查验一名没当过湖仙的玩家，只能看到阵营（好 / 坏），然后 token 传给被查验者，共 ${AVALON_LADY_ROUNDS.length} 次。`,
      ),
    ).toBeVisible();
    expect(
      view.getByText(
        `好人拿下 ${AVALON_QUESTS_TO_WIN} 个任务后进入刺杀：坏人线下口头商量，刺客在 App 内点选一名玩家指认（除自己外任意座位），二次确认后结算。指认出梅林坏人翻盘，否则好人获胜。`,
      ),
    ).toBeVisible();
  });
});
