/** Werewolf gameplay introduction; describes face-to-face play without computing game outcomes. */
import { type GameState, ROLE_SPECS } from '@game-judge/game-engine/games/werewolf/public';
import { Text } from 'react-native';

import { GameGuideSection, GameNotice, RuleItem } from '@/components/GameGuide';
import { GameScreenContent, gameScreenStyles } from '@/components/GameScreen';

/** Presents the basic flow and the assistant's first-night boundary. */
export function WerewolfGameplayContent({
  gameState,
  isHost,
  hasRoomContext,
}: {
  readonly gameState: Pick<GameState, 'templateRoles' | 'rules'> | null;
  readonly isHost: boolean;
  readonly hasRoomContext: boolean;
}) {
  return (
    <GameScreenContent>
      <Text style={gameScreenStyles.sectionTitle} accessibilityRole="header" aria-level={1}>
        狼人杀
      </Text>
      <Text style={gameScreenStyles.description}>
        隐藏身份，通过夜间行动、白天讨论和投票，为自己的阵营争取胜利。
      </Text>
      {hasRoomContext && (
        <GameGuideSection title="本局规则">
          {gameState === null ? (
            <Text style={gameScreenStyles.description}>
              暂未获取本局配置，请返回房间确认连接后重试。
            </Text>
          ) : (
            <>
              <RuleItem
                icon="people-outline"
                title={`本局板子 · ${gameState.templateRoles.length} 人`}
                description={gameState.templateRoles
                  .map((roleId) => ROLE_SPECS[roleId].displayName)
                  .join('、')}
              />
              <RuleItem
                icon="ribbon-outline"
                title="首日警长竞选"
                description={
                  gameState.rules?.isSheriffElectionEnabled
                    ? '已开启：首夜结束后进行首日警长竞选。'
                    : '未开启：本局不进行首日警长竞选。'
                }
              />
              <RuleItem
                icon="flask-outline"
                title="女巫自救"
                description={
                  gameState.rules?.witchCanSelfHeal
                    ? '已开启：女巫可以对自己使用解药。'
                    : '未开启：女巫不能对自己使用解药。'
                }
              />
              {isHost && gameState.rules?.isPlagueMode && (
                <RuleItem
                  icon="information-circle-outline"
                  title="黑死病模式（仅房主可见）"
                  description="已开启：狼人牌暗中替换为平民，公开板子仍保留狼人配置。发牌后请由房主担任真人法官主持后续流程。"
                />
              )}
            </>
          )}
        </GameGuideSection>
      )}
      <GameGuideSection title="胜负目标">
        <RuleItem
          icon="people-outline"
          title="好人阵营"
          description="通过发言、查验等信息辨认狼人，投票放逐狼人。通常以所有狼人出局为胜利目标。"
        />
        <RuleItem
          icon="moon-outline"
          title="狼人阵营"
          description="隐藏身份、干扰好人判断，通过夜间行动和白天投票淘汰对手。屠边、屠城等胜利条件须在开局前按本桌板子约定。"
        />
        <RuleItem
          icon="flag-outline"
          title="特殊阵营与角色"
          description="部分板子包含特殊阵营、身份转换或独立胜利条件，以对应角色和板子说明为准。"
        />
      </GameGuideSection>
      <GameGuideSection title="基本流程">
        <RuleItem
          icon="eye-outline"
          title="入座与查看身份"
          description="确认板子和规则后入座，等待房主分配身份。私下查看自己的身份，不向其他玩家展示身份界面。"
        />
        <RuleItem
          icon="moon-outline"
          title="夜间行动"
          description="按语音和界面提示行动。只有当前行动角色进行选择或确认，其他玩家等待，避免用言语或动作泄露信息。"
        />
        <RuleItem
          icon="sunny-outline"
          title="天亮与讨论"
          description="首夜结束后公布夜间结果；启用警长竞选时按本桌流程竞选。玩家轮流发言，结合公开信息讨论身份。"
        />
        <RuleItem
          icon="hand-left-outline"
          title="投票与后续轮次"
          description="按本桌约定投票放逐玩家，处理角色技能并判断胜负。未结束时继续下一轮昼夜，后续夜晚由现场主持。"
        />
      </GameGuideSection>
      <GameGuideSection title="玩家与房主">
        <RuleItem
          icon="person-outline"
          title="每位玩家"
          description="使用自己的座位查看身份，并按提示提交夜间行动。身份、技能信息和公开结果的可见范围不同，不要把私密界面展示给其他人。"
        />
        <RuleItem
          icon="volume-high-outline"
          title="房主也是玩家"
          description="房主负责配置板子、开始游戏、播放公共语音和推进公共流程；个人技能仍按自己的身份操作。"
        />
      </GameGuideSection>
      <GameNotice text="助手处理首夜行动与结算，并提供已实现的公共流程工具；不是整局自动裁判。后续夜晚、现场讨论及最终胜负由本桌按约定规则主持和确认。" />
    </GameScreenContent>
  );
}
