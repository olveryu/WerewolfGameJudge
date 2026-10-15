/**
 * Demo房间：大厅走共享座位表；发牌后是身份查看与对局工作区。
 */

import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary, RoomGuideButton } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { DemoRoomSession } from '@/games/demo/model/DemoRoomSession';
import { borderRadius, colors, fixed, spacing, textStyles } from '@/theme';

import { DemoRoleCardModal } from './components/DemoRoleCardModal';
import { type DemoRoomScreenState, useDemoRoomState } from './hooks/useDemoRoomState';

type DemoRoomScreenProps = GameRoomScreenProps<'demo'> & {
  readonly session: DemoRoomSession;
};

/** 使用平台入场生命周期处理直链、加入与重连。 */
export function DemoRoomScreen(props: DemoRoomScreenProps) {
  return (
    <RoomEntryBoundary
      room={props.room}
      session={props.session}
      onExit={() => exitRoomFlow(props.navigation)}
    >
      {(entryController) => <DemoRoomContent {...props} entryController={entryController} />}
    </RoomEntryBoundary>
  );
}

function DemoRoomContent(
  props: DemoRoomScreenProps & { readonly entryController: RoomEntryController },
) {
  const screen = useDemoRoomState(props);
  const config = screen.state.config;
  const isLobby = screen.state.phase.kind === 'lobby';
  return (
    <RoomShell
      model={screen.shellModel}
      content={
        isLobby
          ? {
              kind: 'seats',
              contextHeader: null,
              afterSeatBoard: null,
              sideInspector: null,
              beforeSeatBoard: (
                <RoomGameSummary
                  icon="game-controller-outline"
                  title={`Demo · ${config.numberOfPlayers}人局`}
                  subtitle="模板参照游戏"
                  headerRight={<RoomGuideButton onPress={screen.openRules} label="查看Demo玩法" />}
                />
              ),
            }
          : {
              kind: 'workspace',
              element: <DemoStageArea screen={screen} />,
            }
      }
      leadingExtraActions={null}
      trailingExtraActions={null}
      gameOverlays={
        <DemoRoleCardModal
          visible={screen.roleCardVisible}
          identity={screen.viewModel?.myIdentity ?? null}
          effectType={null}
          shouldPlay={screen.roleCardShouldPlay}
          allRoles={screen.roleCardAllRoles}
          remainingCards={screen.roleCardRemainingCards}
          onClose={() => screen.setRoleCardVisible(false)}
        />
      }
    />
  );
}

/**
 * 对局工作区（座位表之外的阶段层）。TODO(gameplay): 玩法阶段 UI 在这里
 * 按落点总规则组装——公共阶段状态归状态条、个人指令归底部消息、个人
 * 动作归底部按钮、逐座状态归座位徽标、一次性信息归弹窗；座位表下方
 * 不加阶段层（afterSeatBoard 恒为 null，CI 扫描钉死）。
 */
function DemoStageArea({ screen }: { readonly screen: DemoRoomScreenState }) {
  const phase = screen.state.phase;
  return (
    <View style={styles.stageArea}>
      <Text style={styles.stageTitle}>
        {phase.kind === 'viewing'
          ? '身份查看'
          : phase.kind === 'ended'
            ? '本局已结束'
            : '对局进行中'}
      </Text>
      <Text style={styles.stageHint}>
        {phase.kind === 'viewing'
          ? '点下方按钮查看你的身份；全员查看完后由房主开始游戏。'
          : 'TODO(gameplay):玩法阶段界面随玩法状态机落地。'}
      </Text>
      {phase.kind !== 'ended' ? (
        <Button variant="secondary" size="lg" onPress={screen.onViewRolePress}>
          查看我的身份
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stageArea: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.small,
    padding: spacing.medium,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  stageTitle: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
  },
  stageHint: {
    ...textStyles.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
