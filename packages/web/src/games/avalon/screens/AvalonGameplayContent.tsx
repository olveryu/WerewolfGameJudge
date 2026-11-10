/**
 * AvalonGameplayContent — 阿瓦隆图鉴「玩法」段。
 *
 * 内容自原 AvalonRulesScreen 整段迁入（该屏已删，全仓只剩这一份规则文案），
 * 沿用共享 GameGuide 阅读件。原屏的「角色」区手写文案是双源本体，已删除：
 * 角色介绍只在角色段由共享图鉴消费 avalonRoleMeta。
 * 文案数字全部取自引擎常量与板子数据。
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

import { GameGuideSection, GameNotice, RuleItem } from '@/components/GameGuide';

import { getAvalonRoleDisplayName } from '../model/avalonRoleDisplay';

/** 结算揭晓倒计时（秒）：全平台唯一的结算口径，毫秒常量换算。 */
const SETTLE_COUNTDOWN_SECONDS = SETTLE_COUNTDOWN_MS / 1000;

/** 统计一张板子里某角色的人数。 */
function countBoardRole(roles: readonly AvalonRoleId[], role: AvalonRoleId): number {
  return roles.filter((candidate) => candidate === role).length;
}

/** 板子内同一角色的写法：忠臣恒带人数，其余角色只在重复时带人数。 */
function formatBoardRole(role: AvalonRoleId, count: number): string {
  const name = getAvalonRoleDisplayName(role);
  return role === 'loyalServant' || count > 1 ? `${name} ×${count}` : name;
}

/** 一张板子的全量构成：好人侧 vs 坏人侧，按板子内首次出现顺序列出。 */
function describeBoardComposition(roles: readonly AvalonRoleId[]): string {
  const seen: AvalonRoleId[] = [];
  for (const role of roles) {
    if (!seen.includes(role)) seen.push(role);
  }
  const describeSide = (evil: boolean): string =>
    seen
      .filter((role) => isAvalonEvilRole(role) === evil)
      .map((role) => formatBoardRole(role, countBoardRole(roles, role)))
      .join('、');
  return `${describeSide(false)} vs ${describeSide(true)}`;
}

/**
 * 相对首张板子的变化：忠臣绝对数 + 新增角色（1 个为“加 X”，多个为“X 与 Y 全上”）。
 */
function describeBoardDelta(
  baseRoles: readonly AvalonRoleId[],
  roles: readonly AvalonRoleId[],
): string {
  const loyalPart = `忠臣 ×${countBoardRole(roles, 'loyalServant')}`;
  const extraNames = AVALON_ROLES.filter(
    (role) => !baseRoles.includes(role) && roles.includes(role),
  ).map((role) => getAvalonRoleDisplayName(role));
  if (extraNames.length === 0) return loyalPart;
  if (extraNames.length === 1) return `${loyalPart}，加${extraNames.join('、')}`;
  return `${loyalPart}，${extraNames.join('与')}全上`;
}

/** 板子说明：首张板子全量列出，其余只写相对首张板子的变化。 */
function describeAvalonBoards(): string {
  const parts: string[] = [];
  let baseRoles: readonly AvalonRoleId[] | null = null;
  for (const playerCount of AVALON_PLAYER_COUNTS) {
    const roles = AVALON_BOARDS[playerCount];
    if (baseRoles === null) {
      baseRoles = roles;
      parts.push(`${playerCount} 人：${describeBoardComposition(roles)}`);
    } else {
      parts.push(`${playerCount} 人：${describeBoardDelta(baseRoles, roles)}`);
    }
  }
  return `${parts.join('；')}。`;
}

/** 阿瓦隆玩法说明段。 */
export function AvalonGameplayContent() {
  return (
    <div className="encyclopedia-scroll">
      <div className="game-guide">
        <p className="game-guide-kicker">游戏目标</p>
        <h2 className="game-guide-heading">好人做任务，坏人搞破坏</h2>
        <p className="game-guide-intro">
          {`${AVALON_MIN_PLAYERS}–${AVALON_MAX_PLAYERS} 人身份推理：好人阵营轮流组队执行 ${AVALON_QUEST_COUNT} 轮任务，先拿下 ${AVALON_QUESTS_TO_WIN} 个任务获胜；坏人混在队伍里出失败牌破坏任务，连续否决组队或终局刺杀梅林也能获胜。`}
        </p>
        <GameGuideSection title="一轮怎么玩">
          <RuleItem
            icon="moon-outline"
            title="晚上：睁眼认人"
            description="天黑后坏人先睁眼互认（奥伯伦不参与互认，谁也看不见），梅林睁眼看到坏人（看不见莫德雷德），派西维尔睁眼看到梅林和莫甘娜（分不清谁是谁）。每人点确认推进。"
          />
          <RuleItem
            icon="people-outline"
            title="组队者组队"
            description="每轮由组队者选出规定人数的队员（可含自己），全员线下口头讨论，不限时。"
          />
          <RuleItem
            icon="checkbox-outline"
            title="投票：赞成 / 反对"
            description={`全员对队伍投票，可改票。全员投完武装 ${SETTLE_COUNTDOWN_SECONDS} 秒倒计时、到期自动结算：赞成多于反对则通过，否则否决（含平票）；单轮连续否决达到上限（建房时设置，${AVALON_VETO_LIMIT_MIN}–${AVALON_VETO_LIMIT_MAX}，默认 ${AVALON_DEFAULT_VETO_LIMIT}），坏人直接获胜。公投模式同时亮票，暗投模式只公布赞成 / 反对数量。`}
          />
          <RuleItem
            icon="trophy-outline"
            title="任务：秘密出牌"
            description={`队员秘密出牌：好人只能出成功，坏人可出成功或失败。出完可改牌；全员出完武装 ${SETTLE_COUNTDOWN_SECONDS} 秒倒计时、到期自动结算，洗混亮牌，只公布成功 / 失败数量，不揭晓出牌人。${AVALON_FOURTH_QUEST_DOUBLE_FAIL_MIN_PLAYERS} 人及以上第 ${AVALON_DOUBLE_FAIL_QUEST_ROUND} 轮需要 ${AVALON_DOUBLE_FAILS_NEEDED} 张失败牌才算失败。`}
          />
        </GameGuideSection>
        <GameGuideSection title="板子：人数即板子">
          <RuleItem
            icon="layers-outline"
            title={`${AVALON_PLAYER_COUNTS.length} 张固定板子`}
            description={describeAvalonBoards()}
          />
        </GameGuideSection>
        <GameGuideSection title="湖中仙女与刺杀">
          <RuleItem
            icon="water-outline"
            title={`湖中仙女（${AVALON_LADY_MIN_PLAYERS} / ${AVALON_MAX_PLAYERS} 人局）`}
            description={`开局 token 给首任组队者右手边的玩家。第 ${AVALON_LADY_ROUNDS.join('、')} 轮任务结算后，持有人私下查验一名没当过湖仙的玩家，只能看到阵营（好 / 坏），然后 token 传给被查验者，共 ${AVALON_LADY_ROUNDS.length} 次。`}
          />
          <RuleItem
            icon="locate-outline"
            title="终局刺杀"
            description={`好人拿下 ${AVALON_QUESTS_TO_WIN} 个任务后进入刺杀：坏人线下口头商量，刺客在 App 内点选一名玩家指认（除自己外任意座位），二次确认后结算。指认出梅林坏人翻盘，否则好人获胜。`}
          />
          <RuleItem
            icon="warning-outline"
            title="提前刺杀"
            description="晚上结束后、游戏结束前任意时刻，刺客可通过常驻「刺杀」按钮提前刺杀：刺中梅林坏人直接获胜，刺错好人直接获胜。"
          />
        </GameGuideSection>
        <GameNotice text="机器人仅用于测试凑人数：房主在大厅点「填充机器人」，机器人不会自己行动，由房主接管代打。" />
      </div>
    </div>
  );
}
