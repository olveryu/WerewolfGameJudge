/** 聚会工具房间：准备时按账号入座，开始后参与者在工作区使用骰子与身份牌。 */
import '../components/ToolboxTabs.css';
import './ToolboxRoomScreen.css';

import { Tabs } from '@ark-ui/react/tabs';
import type {
  ToolboxIdentityConfig,
  ToolboxView,
} from '@game-judge/game-engine/games/toolbox/public';
import {
  hasEnoughToolboxCards,
  isUsableToolboxIdentityConfig,
} from '@game-judge/game-engine/games/toolbox/public';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/Button';
import {
  ResidentAvatarTile,
  ResidentSceneLayer,
} from '@/features/product/components/ResidentPreview';
import { RoomDialog } from '@/features/room/components/RoomDialog';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSettings, RoomGameSummary } from '@/features/room/components/RoomGameSummary';
import {
  type RoomInformation,
  RoomInformationDialog,
} from '@/features/room/components/RoomInformationDialog';
import { RoomShell } from '@/features/room/components/RoomShell';
import { confirmAction } from '@/features/room/confirm';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import { resolveResidentDecorations } from '@/scene/residentDecorations';
import { TESTIDS } from '@/testids';

import { ToolboxIdentityEditor, ToolboxIdentitySummary } from '../config/ToolboxIdentityEditor';
import type { ToolboxRoomSession } from '../model/ToolboxRoomSession';
import { ToolboxGuide } from '../screens/ToolboxGuideScreen';
import { ToolboxDiceCup } from './ToolboxDiceCup';
import { ToolboxIdentityPanel } from './ToolboxIdentityPanel';
import { describeToolboxSettings, TOOLBOX_ACTION_KEYS } from './toolboxRoomAdapter';
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
  const { view } = screen;
  const isPreparing = view.phase.kind === 'preparing';
  const settings = describeToolboxSettings(view.config);
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
            />
            <ToolboxWorkspace screen={screen} />
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
            configuration={<RoomGameSettings settings={settings} />}
            onClose={() => setInformation(null)}
          />
          {screen.identityRestartDraft !== null &&
            view.phase.kind === 'active' &&
            view.phase.identity !== null && <ToolboxIdentityRestartDialog screen={screen} />}
        </>
      }
    />
  );
}

/** 未成为成员、准备中和观看者看到大号状态；使用中的参与者看到自己的工具。 */
function ToolboxWorkspace({ screen }: { readonly screen: ToolboxRoomScreenState }) {
  const { view } = screen;
  if (view.phase.kind === 'active' && view.phase.participation.kind === 'participant')
    return <ToolboxParticipantTools screen={screen} />;
  return <ToolboxPresenceStatus screen={screen} />;
}

type PresenceState = 'joining' | 'unseated' | 'seated' | 'watching';

const PRESENCE_COPY: Readonly<
  Record<PresenceState, { readonly label: string; readonly detail: string }>
> = {
  joining: { label: '正在进入房间', detail: '连接后即可入座' },
  unseated: { label: '请入座', detail: '点下方「入座」参与本次使用' },
  seated: { label: '已入座', detail: '等待房主开始' },
  watching: { label: '观看中', detail: '本次已开始，你可以观看公开信息' },
};

function resolvePresenceState(view: ToolboxView): PresenceState {
  if (!view.isViewerMember) return 'joining';
  if (view.phase.kind === 'active') return 'watching';
  return view.phase.isViewerSeated ? 'seated' : 'unseated';
}

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

function ToolboxParticipantTools({ screen }: { readonly screen: ToolboxRoomScreenState }) {
  const { view, submit, isLocked } = screen;
  if (view.phase.kind !== 'active' || view.phase.participation.kind !== 'participant')
    throw new Error('[FAIL-FAST] participant tools require an active participant view');
  const { dice, hand } = view.phase.participation;
  const identity = view.phase.identity;
  const diceElement =
    dice === null ? null : (
      <ToolboxDiceCup
        cup={dice}
        isLocked={isLocked}
        onRoll={() =>
          submit(
            '摇骰',
            { type: 'toolbox.dice.roll', cupVersion: dice.version },
            { actionKey: null },
          )
        }
        onReveal={() =>
          void submit(
            '掀开骰盅',
            { type: 'toolbox.dice.reveal', cupVersion: dice.version },
            { actionKey: null },
          )
        }
        onSetCount={(count) =>
          void submit(
            '调整骰子数量',
            { type: 'toolbox.dice.setCount', count, cupVersion: dice.version },
            { actionKey: null },
          )
        }
        onToggleHold={(dieId) =>
          void submit(
            '固定骰子',
            { type: 'toolbox.dice.toggleHold', dieId, cupVersion: dice.version },
            { actionKey: null },
          )
        }
      />
    );
  if ((identity === null) !== (hand === null))
    throw new Error('[FAIL-FAST] toolbox identity round and hand must be enabled together');
  const identityElement =
    identity === null || hand === null ? null : (
      <ToolboxIdentityPanel
        round={identity}
        hand={hand}
        isLocked={isLocked}
        onDraw={() =>
          submit(
            '抽身份',
            { type: 'toolbox.identity.draw', roundId: identity.roundId },
            { actionKey: null },
          )
        }
      />
    );
  if (diceElement === null || identityElement === null)
    return <div className="toolbox-room-tools">{diceElement ?? identityElement}</div>;
  return (
    <Tabs.Root defaultValue="dice" className="toolbox-room-tools" lazyMount={false}>
      <Tabs.List className="toolbox-tabs" aria-label="本次工具">
        <Tabs.Trigger value="dice" className="toolbox-tab">
          骰子
        </Tabs.Trigger>
        <Tabs.Trigger value="identity" className="toolbox-tab">
          身份牌
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="dice">{diceElement}</Tabs.Content>
      <Tabs.Content value="identity">{identityElement}</Tabs.Content>
    </Tabs.Root>
  );
}

/** 房主在使用中重开身份：编辑后整轮重开，骰子不受影响。 */
function ToolboxIdentityRestartDialog({ screen }: { readonly screen: ToolboxRoomScreenState }) {
  const { view, identityRestartDraft: draft } = screen;
  const [isSubmitting, setIsSubmitting] = useState(false);
  if (draft === null || view.phase.kind !== 'active' || view.phase.identity === null)
    throw new Error('[FAIL-FAST] identity restart dialog requires an active identity round');
  const roundId = view.phase.identity.roundId;
  const participantCount = view.phase.participantCount;
  const update = (identity: ToolboxIdentityConfig) => screen.setIdentityRestartDraft(identity);
  const isReady =
    isUsableToolboxIdentityConfig(draft) && hasEnoughToolboxCards(draft, participantCount);
  const close = () => {
    if (!isSubmitting) screen.setIdentityRestartDraft(null);
  };
  const restart = () =>
    confirmAction({
      label: '重开身份？',
      body: '重开后，本轮已抽身份将清空，骰子不受影响。',
      tone: 'danger',
      confirmText: '重开',
      onConfirm: async () => {
        setIsSubmitting(true);
        const isRestarted = await screen
          .submit(
            '重开身份',
            { type: 'toolbox.identity.restart', roundId, identity: draft },
            { actionKey: TOOLBOX_ACTION_KEYS.restartIdentity },
          )
          .finally(() => setIsSubmitting(false));
        if (isRestarted) screen.setIdentityRestartDraft(null);
      },
    });
  return (
    <RoomDialog
      title="重开身份"
      onClose={close}
      dismissOnEscape
      footer={
        <div className="toolbox-room-restart-footer">
          <ToolboxIdentitySummary
            value={draft}
            onCardsPerPlayerChange={(cardsPerPlayer) => update({ ...draft, cardsPerPlayer })}
            requirement={{ playerCount: participantCount, label: `本次 ${participantCount} 人` }}
            isDisabled={isSubmitting}
          />
          <Button
            size="lg"
            disabled={!isReady || screen.isLocked}
            loading={isSubmitting}
            onClick={restart}
          >
            重开身份
          </Button>
        </div>
      }
    >
      <ToolboxIdentityEditor
        value={draft}
        onChange={update}
        isAnonymous={screen.user.isAnonymous}
        isDisabled={isSubmitting}
      />
    </RoomDialog>
  );
}
