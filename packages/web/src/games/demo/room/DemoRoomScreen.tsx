/** Demo房间：大厅走共享座位表；发牌后是身份查看与对局工作区。 */
import './DemoRoomScreen.css';

import type { DemoState } from '@game-judge/game-engine/games/demo/public';
import { useNavigate } from 'react-router';

import { Button } from '@/components/Button';
import { RevealRoleCardModal } from '@/features/room/components/RevealRoleCardModal';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary, RoomGuideButton } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { resolveViewIdentityAction } from '@/features/room/model/RoomBottomActions';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import type { DemoRoomSession } from '@/games/demo/model/DemoRoomSession';

import { toRevealRoleData } from '../components/DemoRoleCardAdapter';
import { type DemoRoomScreenState, useDemoRoomState } from './hooks/useDemoRoomState';

type DemoRoomScreenProps = GameRoomScreenProps<'demo'> & {
  readonly session: DemoRoomSession;
  /** 模块声明的本局复盘（defineClientGameModule 的 review）；房间只渲染这一份。 */
  readonly review: RoomReviewContribution<DemoState>;
};

/** 使用平台入场生命周期处理直链、加入与重连。 */
export function DemoRoomScreen(props: DemoRoomScreenProps) {
  const navigate = useNavigate();
  return (
    <RoomEntryBoundary
      room={props.room}
      session={props.session}
      onExit={() => exitRoomFlow(navigate)}
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
          : { kind: 'workspace', element: <DemoStageArea screen={screen} /> }
      }
      leadingExtraActions={null}
      trailingExtraActions={null}
      gameOverlays={
        <>
          <RevealRoleCardModal
            visible={screen.roleViewing.isOpen}
            roleKey={screen.viewModel?.myIdentity ?? null}
            toRoleData={toRevealRoleData}
            onClose={screen.roleViewing.close}
          />
          {screen.reviewOverlay}
        </>
      }
    />
  );
}

/**
 * 对局工作区（座位表之外的阶段层）。TODO(gameplay): 玩法阶段 UI 在这里按落点总规则组装——
 * 公共步进进度归底部进度行、个人指令归底部消息、个人动作归底部按钮、逐座状态归座位徽标、
 * 一次性信息归弹窗；座位表下方不加阶段层（afterSeatBoard 恒为 null）。
 */
function DemoStageArea({ screen }: { readonly screen: DemoRoomScreenState }) {
  const phase = screen.state.phase;
  // 查看动作定义走共享解析（身份模板同形态）：此处是 stage 区表面渲染。
  const viewIdentityAction = resolveViewIdentityAction({
    isVisible: phase.kind !== 'ended',
    label: '查看我的身份',
    onPress: screen.roleViewing.open,
  });
  return (
    <section className="demo-stage">
      <h2 className="demo-stage-title">
        {phase.kind === 'viewing'
          ? '身份查看'
          : phase.kind === 'ended'
            ? '本局已结束'
            : '对局进行中'}
      </h2>
      <p className="demo-stage-hint">
        {phase.kind === 'viewing'
          ? '点下方按钮查看你的身份；全员查看完后由房主开始游戏。'
          : 'TODO(gameplay):玩法阶段界面随玩法状态机落地。'}
      </p>
      {viewIdentityAction !== null && (
        <Button
          variant="secondary"
          size="lg"
          disabled={screen.isSubmitting}
          onClick={viewIdentityAction.onPress}
        >
          {viewIdentityAction.label}
        </Button>
      )}
    </section>
  );
}
