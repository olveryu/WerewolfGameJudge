/** 聚会工具房间：准备时按账号入座，开始后参与者从手牌打开骰子与抽牌弹窗。 */
import './ToolboxRoomScreen.css';

import type { ToolboxView } from '@game-judge/game-engine/games/toolbox/public';
import { type ReactNode, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  ResidentAvatarTile,
  ResidentSceneLayer,
} from '@/features/product/components/ResidentPreview';
import { BoardInfoContent } from '@/features/room/components/BoardInfoContent';
import { RoleCardDialog } from '@/features/room/components/RoleCard';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSettings, RoomGameSummary } from '@/features/room/components/RoomGameSummary';
import {
  type RoomInformation,
  RoomInformationDialog,
} from '@/features/room/components/RoomInformationDialog';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import { resolveResidentDecorations } from '@/scene/residentDecorations';
import { TESTIDS } from '@/testids';

import type { ToolboxRoomSession } from '../model/ToolboxRoomSession';
import { ToolboxGuide } from '../screens/ToolboxGuideScreen';
import { ToolboxDiceDialog } from './ToolboxDiceCup';
import {
  createToolboxIdentityBoardSections,
  toToolboxIdentityPreviewData,
} from './toolboxIdentityBoard';
import { ToolboxDrawDialog } from './ToolboxIdentityPanel';
import { describeToolboxSettings } from './toolboxRoomAdapter';
import { type ToolboxRoomScreenState, useToolboxRoomState } from './useToolboxRoomState';

type ToolboxRoomScreenProps = GameRoomScreenProps<'toolbox'> & {
  readonly session: ToolboxRoomSession;
  readonly review: RoomReviewContribution<ToolboxView>;
};

/** 使用平台入场生命周期处理直链、加入与重连。 */
export function ToolboxRoomScreen(props: ToolboxRoomScreenProps) {
  const navigate = useNavigate();
  return (
    <RoomEntryBoundary
      room={props.room}
      session={props.session}
      onExit={() => exitRoomFlow(navigate)}
    >
      {(entryController) => <ToolboxRoomContent {...props} entryController={entryController} />}
    </RoomEntryBoundary>
  );
}

function ToolboxRoomContent(
  props: ToolboxRoomScreenProps & { readonly entryController: RoomEntryController },
) {
  const screen = useToolboxRoomState(props);
  const [information, setInformation] = useState<RoomInformation>(null);
  const [previewRoleId, setPreviewRoleId] = useState<string | null>(null);
  const { view } = screen;
  const isPreparing = view.phase.kind === 'preparing';
  const settings = describeToolboxSettings(view.config);
  const identity = view.config.tools.includes('identity') ? view.config.identity : null;
  const board =
    identity === null ? null : (
      <BoardInfoContent
        sections={createToolboxIdentityBoardSections(identity)}
        onRolePress={setPreviewRoleId}
        footer={null}
      />
    );
  return (
    <RoomShell
      model={screen.shellModel}
      phaseLabel={isPreparing ? '待开始' : '使用中'}
      actionSurface="hand"
      directory={{
        main: [],
        manual: [
          {
            key: 'guide',
            label: '玩法',
            category: 'resource',
            icon: 'book-outline',
            testID: TESTIDS.roomGuideButton('toolbox'),
            opensDialog: true,
            state: { kind: 'ready', onPress: () => setInformation('guide') },
          },
        ],
        openConfiguration: isPreparing ? null : () => setInformation('configuration'),
      }}
      content={{
        kind: 'workspace',
        element: (
          <div className="toolbox-room">
            <RoomGameSummary
              title="聚会工具"
              playerCount={view.memberCount}
              settings={settings}
              guide={null}
              collapsed={!isPreparing}
            >
              {board}
            </RoomGameSummary>
            <ToolboxPresenceStatus screen={screen} />
          </div>
        ),
      }}
      leadingExtraActions={null}
      trailingExtraActions={null}
      gameOverlays={
        <>
          <RoomInformationDialog
            information={information}
            guideTitle="聚会工具玩法"
            guide={<ToolboxGuide embedded />}
            configuration={
              <>
                {board}
                <RoomGameSettings settings={settings} />
              </>
            }
            onClose={() => setInformation(null)}
          />
          {previewRoleId !== null && identity !== null && (
            <RoleCardDialog
              role={toToolboxIdentityPreviewData(identity, previewRoleId)}
              onClose={() => setPreviewRoleId(null)}
              descriptionTitle="身份说明"
            />
          )}
          <ToolboxDialogs screen={screen} />
        </>
      }
    />
  );
}

type PresenceState = 'joining' | 'unseated' | 'seated' | 'participating' | 'watching';

const PRESENCE_COPY: Readonly<
  Record<PresenceState, { readonly label: string; readonly detail: string }>
> = {
  joining: { label: '正在进入房间', detail: '连接后即可入座' },
  unseated: { label: '请入座', detail: '点下方「入座」参与本次使用' },
  seated: { label: '已入座', detail: '等待房主开始' },
  participating: { label: '本次参与中', detail: '从下方手牌打开本次工具' },
  watching: { label: '观看中', detail: '本次已开始，你可以观看公开信息' },
};

function resolvePresenceState(view: ToolboxView): PresenceState {
  if (!view.isViewerMember) return 'joining';
  if (view.phase.kind === 'active')
    return view.phase.participation.kind === 'participant' ? 'participating' : 'watching';
  return view.phase.isViewerSeated ? 'seated' : 'unseated';
}

/** 所有人都看到的中央状态：阶段、本人头像与名字、本人状态和人数。 */
function ToolboxPresenceStatus({ screen }: { readonly screen: ToolboxRoomScreenState }) {
  const { view, user } = screen;
  const sceneHostRef = useRef<HTMLDivElement>(null);
  const presence = resolvePresenceState(view);
  const copy = PRESENCE_COPY[presence];
  const residents = resolveResidentDecorations({
    ...(user.avatarFrame === null ? {} : { avatarFrame: user.avatarFrame }),
    ...(user.seatFlair === null ? {} : { seatFlair: user.seatFlair }),
    ...(user.seatAnimation === null ? {} : { seatAnimation: user.seatAnimation }),
  });
  const countLabel =
    view.phase.kind === 'preparing'
      ? `已入座 ${view.phase.seatedCount} 人`
      : `本次参与 ${view.phase.participantCount} 人`;
  return (
    <section className="toolbox-room-status" data-state={presence} aria-live="polite">
      <ResidentSceneLayer hostRef={sceneHostRef} />
      <p className="toolbox-room-phase">
        {view.phase.kind === 'preparing' ? '等待开始' : '使用中'}
      </p>
      <button
        type="button"
        className="toolbox-room-avatar"
        onClick={screen.openOwnProfile}
        aria-label="查看我的资料"
      >
        <ResidentAvatarTile
          userId={user.id}
          avatarUrl={user.avatarUrl}
          residents={residents}
          sceneHostRef={sceneHostRef}
        />
      </button>
      <p className="toolbox-room-name">{user.displayName ?? '匿名玩家'}（你）</p>
      <p className="toolbox-room-status-label" role="status">
        {copy.label}
      </p>
      <p className="toolbox-room-status-detail">{copy.detail}</p>
      <p className="toolbox-room-counts">
        <span>{countLabel}</span>
        <span>房间共 {view.memberCount} 人</span>
      </p>
    </section>
  );
}

/** 手牌与房主面板打开的弹窗；每个弹窗只在对应工具可用时出现。 */
function ToolboxDialogs({ screen }: { readonly screen: ToolboxRoomScreenState }): ReactNode {
  const { view, submit, isLocked, dialog, closeDialog } = screen;
  if (dialog === null) return null;
  if (view.phase.kind !== 'active')
    throw new Error(`[FAIL-FAST] toolbox dialog ${dialog} requires the active phase`);
  const { participation, sessionId } = view.phase;
  switch (dialog) {
    case 'dice': {
      if (participation.kind !== 'participant' || participation.dice === null)
        throw new Error('[FAIL-FAST] dice dialog requires a participant cup');
      const cup = participation.dice;
      return (
        <ToolboxDiceDialog
          cup={cup}
          isLocked={isLocked}
          onClose={closeDialog}
          onRoll={() =>
            submit(
              '摇骰',
              { type: 'toolbox.dice.roll', cupVersion: cup.version },
              { actionKey: null },
            )
          }
          onReveal={() =>
            void submit(
              '掀开骰盅',
              { type: 'toolbox.dice.reveal', cupVersion: cup.version },
              { actionKey: null },
            )
          }
          onSetCount={(count) =>
            submit(
              '调整骰子数量',
              { type: 'toolbox.dice.setCount', count, cupVersion: cup.version },
              { actionKey: null },
            )
          }
          onToggleHold={(dieId) =>
            void submit(
              '固定骰子',
              { type: 'toolbox.dice.toggleHold', dieId, cupVersion: cup.version },
              { actionKey: null },
            )
          }
        />
      );
    }
    case 'draw': {
      const round = view.phase.identity;
      if (participation.kind !== 'participant' || participation.hand === null || round === null)
        throw new Error('[FAIL-FAST] draw dialog requires a participant hand and identity round');
      return (
        <ToolboxDrawDialog
          round={round}
          hand={participation.hand}
          isLocked={isLocked}
          onClose={closeDialog}
          onDraw={() =>
            submit('抽身份', { type: 'toolbox.identity.draw', sessionId }, { actionKey: null })
          }
        />
      );
    }
  }
}
