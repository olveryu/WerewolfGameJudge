/** Shared visual frame for every game room. Game adapters provide models and explicit slots. */
import './RoomShell.css';

import { type ReactElement, type ReactNode, useEffect, useRef } from 'react';

import { Avatar } from '@/components/avatar/Avatar';
import { IconButton } from '@/components/IconButton';
import { useLongPress } from '@/features/room/hooks/useLongPress';
import { useRoomHandNavigation } from '@/features/room/hooks/useRoomHandNavigation';
import { resolveHostTaskView } from '@/features/room/model/resolveHostTaskView';
import { buildRoomHand, type RoomHandDirectory } from '@/features/room/model/RoomHand';
import { isRoomPlayerActionModelEmpty } from '@/features/room/model/RoomPlayerActions';
import type { RoomHeaderUserAction, RoomShellModel } from '@/features/room/model/RoomShellModel';
import { assertRoomStageShellModel, type RoomStageHudModel } from '@/features/room/model/RoomStage';
import { TESTIDS } from '@/testids';
import IconChevronBack from '~icons/ion/chevron-back';
import IconPersonCircleOutline from '~icons/ion/person-circle-outline';

import type { RoomSelectionMode } from '../model/RoomHand';
import { PlayerProfileCard } from './PlayerProfileCard';
import { RoomActionHand } from './RoomActionHand';
import { RoomActionStatus, type RoomSummaryPresentation } from './RoomActionStatus';
import { RoomBottomActionPanel } from './RoomBottomActionPanel';
import { RoomHostTaskHeader } from './RoomHostTaskHeader';
import { RoomSeatBoard } from './RoomSeatBoard';
import { RoomShareDialog } from './RoomShareDialog';
import { RoomStageHud, type RoomStageHudRenderer } from './RoomStageHud';
import { ConnectionStatusBar, ControlledSeatBanner, RoomSeatConfirmModal } from './RoomStatusBars';

const TITLE_LONG_PRESS_MS = 1000;
const TICKET_BADGE_MAX = 99;

type RoomShellContent =
  | {
      readonly kind: 'seats';
      readonly contextHeader: ReactElement | null;
      readonly bottomSummary: ReactElement | null;
      readonly summaryPresentation?: RoomSummaryPresentation;
      readonly informationLayout?: 'fixed' | 'scroll-with-seats';
      readonly beforeSeatBoard: ReactElement;
      readonly afterSeatBoard: ReactElement | null;
    }
  | { readonly kind: 'workspace'; readonly element: ReactElement }
  /**
   * An in-play stage (docs/room-stage-layout-design.md): the information bar over the game's
   * element, a stage menu in the header, and no bottom panel.
   */
  | {
      readonly kind: 'stage';
      readonly hud: RoomStageHudModel;
      /** A render slot may embed the shared HUD in the game's own stage panel. */
      readonly element: ReactElement | ((renderHud: RoomStageHudRenderer) => ReactElement);
      /** Optional game-owned action beside secondary HUD information. */
      readonly hudAction?: ReactElement;
    };

function RoomStageContent({
  content,
  model,
}: {
  readonly content: Extract<RoomShellContent, { readonly kind: 'stage' }>;
  readonly model: RoomShellModel;
}) {
  const embedded = typeof content.element === 'function';
  const renderHud: RoomStageHudRenderer = (context = null, tone = 'neutral') => (
    <RoomStageHud
      hud={content.hud}
      seats={model.seats.source}
      canTakeOverBots={model.capabilities.canTakeOverBots}
      controlledSeat={model.controlledSeat}
      action={content.hudAction}
      embedded={embedded}
      context={context}
      tone={tone}
    />
  );
  return (
    <div className="room-stage-column">
      {typeof content.element === 'function' ? (
        <div className="room-stage-body">{content.element(renderHud)}</div>
      ) : (
        <>
          {renderHud(null)}
          <div className="room-stage-body">{content.element}</div>
        </>
      )}
    </div>
  );
}

/** The signed-in user's avatar (or a person glyph) with the gacha ticket badge; opens settings. */
function RoomUserButton({ action }: { readonly action: RoomHeaderUserAction }) {
  const { user, ticketCount } = action;
  return (
    <button
      type="button"
      className="room-user-button"
      onClick={action.onPress}
      aria-label="设置"
      data-testid={TESTIDS.roomUserSettingsButton}
    >
      {user === null ? (
        <IconPersonCircleOutline aria-hidden />
      ) : (
        <span className="room-user-avatar-clip">
          <Avatar userId={user.id} avatarUrl={user.avatarUrl ?? null} size={32} />
        </span>
      )}
      {ticketCount !== null && ticketCount > 0 && (
        <span className="room-user-badge">
          {ticketCount > TICKET_BADGE_MAX ? `${TICKET_BADGE_MAX}+` : ticketCount}
        </span>
      )}
    </button>
  );
}

function RoomTitle({ model }: { readonly model: RoomShellModel }) {
  const longPress = useLongPress(model.header.onTitleLongPress, TITLE_LONG_PRESS_MS);
  return (
    <div className="room-header-center">
      <h1 className="room-header-title">
        <button
          type="button"
          className="room-header-title-button"
          aria-describedby="room-title-hint"
          onPointerDown={longPress.onPointerDown}
          onPointerUp={longPress.onPointerUp}
          onPointerLeave={longPress.onPointerLeave}
          onPointerCancel={longPress.onPointerCancel}
          onContextMenu={longPress.onContextMenu}
          onClick={() => {
            if (!longPress.consumeLongPress()) model.header.onTitlePress();
          }}
        >
          房间 {model.roomCode}
        </button>
      </h1>
      <span id="room-title-hint" className="visually-hidden">
        连续点击四次进入管理后台，长按打开调试日志
      </span>
    </div>
  );
}

export function RoomShell({
  model,
  content,
  leadingExtraActions,
  trailingExtraActions,
  actionSurface,
  directory,
  selectionMode,
  phaseLabel = null,
  lobbyAction = null,
  gameOverlays,
  profileDetailsRenderer,
}: {
  readonly model: RoomShellModel;
  readonly content: RoomShellContent;
  readonly leadingExtraActions: ReactNode;
  readonly trailingExtraActions: ReactNode;
  readonly actionSurface?: 'hand' | 'menu' | 'hidden';
  readonly directory: RoomHandDirectory;
  readonly selectionMode?: RoomSelectionMode;
  readonly phaseLabel?: string | null;
  readonly lobbyAction?: { readonly label: string; readonly occupiedSeats: number } | null;
  readonly gameOverlays: ReactNode;
  /** Renders the profile card's game-specific stats section when the model carries gameDetails. */
  readonly profileDetailsRenderer?: (
    statsUserId: string,
    onGamesPlayedChange: (gamesPlayed: number | null) => void,
  ) => ReactNode;
}) {
  const stageMenuEntryRef = useRef<HTMLButtonElement>(null);
  const hostManagement = model.hostManagement;
  const isStage = content.kind === 'stage';
  const resolvedActionSurface = actionSurface ?? 'hand';
  // A hidden hand (werewolf narration) keeps the board status visible.
  const statusInBoard = content.kind === 'seats' && resolvedActionSurface !== 'menu';
  const seatsMissing =
    lobbyAction === null ? 0 : model.seats.source.count - lobbyAction.occupiedSeats;
  const lobbyTask =
    lobbyAction === null || hostManagement === null ? null : resolveHostTaskView(hostManagement);
  const lobbyTitle =
    lobbyAction === null
      ? null
      : seatsMissing > 0
        ? '等待玩家入座'
        : model.viewer.isHost &&
            lobbyTask?.body.kind === 'action' &&
            lobbyTask.body.action.state.kind === 'ready'
          ? `座位已满，可以${lobbyAction.label}`
          : `座位已满，等待房主${lobbyAction.label}`;
  const share = model.capabilities.canShareRoom;
  const navigation = useRoomHandNavigation({
    surface: resolvedActionSurface,
    selectionMode,
    hasManual: directory.manual.length > 0,
    hasHost: hostManagement !== null,
    groupKey: model.playerActions.group?.key ?? null,
  });
  const hand =
    resolvedActionSurface === 'hidden' ||
    (resolvedActionSurface === 'menu' && !navigation.isMenuOpen)
      ? null
      : buildRoomHand({
          phase: model.phase,
          isSubmitting: model.isSubmitting ?? false,
          pendingActionKey: model.pendingActionKey ?? null,
          face: navigation.face,
          playerActions: model.playerActions,
          hostManagement,
          directory,
          share: share.isAllowed ? share : { isAllowed: false, reason: share.reason },
          selectionMode,
          navigation,
        });
  if (isStage) {
    assertRoomStageShellModel(model);
    if (resolvedActionSurface !== 'menu') throw new Error('Stage content requires a stage menu');
  }
  if (resolvedActionSurface === 'menu') {
    if (!isRoomPlayerActionModelEmpty(model.playerActions)) {
      throw new Error(`Room phase "${model.phase}" exposes player actions under the stage menu`);
    }
    if (hostManagement?.task !== null && hostManagement?.task !== undefined) {
      throw new Error(`Room phase "${model.phase}" exposes a host task under the stage menu`);
    }
    const invalidAction = hostManagement?.actions.find(
      (action) => action.stageMenuRole === undefined,
    );
    if (invalidAction !== undefined) {
      throw new Error(
        `Room phase "${model.phase}" has host action "${invalidAction.key}" outside the stage menu`,
      );
    }
  }
  useEffect(() => {
    if (navigation.focus === 'stage-menu:trigger') {
      stageMenuEntryRef.current?.focus({ preventScroll: true });
      navigation.clearFocus();
    }
  }, [navigation]);

  return (
    <div className="room-shell" data-testid={TESTIDS.roomScreenRoot}>
      <header
        className="room-header"
        data-testid={TESTIDS.roomHeader}
        data-phase={model.phase}
        {...(model.step === null ? {} : { 'data-step': model.step })}
      >
        <div className="room-header-side" data-side="leading">
          <IconButton
            label="离开房间"
            icon={<IconChevronBack aria-hidden />}
            onClick={model.header.onBack}
            data-testid={TESTIDS.roomBackButton}
          />
          {leadingExtraActions}
        </div>
        <RoomTitle model={model} />
        <div className="room-header-side" data-side="trailing">
          {trailingExtraActions}
          {resolvedActionSurface === 'menu' && (
            <button
              ref={stageMenuEntryRef}
              type="button"
              className="room-header-host-button"
              aria-expanded={navigation.isMenuOpen}
              onClick={navigation.openMenu}
              data-testid={TESTIDS.roomStageMenuButton}
            >
              菜单
            </button>
          )}
          {model.header.userAction !== null && <RoomUserButton action={model.header.userAction} />}
        </div>
      </header>
      {/* Banner slot: the connection bar first (nothing while live), then a bot-seat takeover. */}
      <ConnectionStatusBar
        status={model.connection.status}
        pendingDurableCount={model.connection.pendingDurableCount}
        onRetryNow={model.connection.onRetryNow}
      />
      {/* Stage content reports the takeover as a chip in its information bar instead. */}
      {model.controlledSeat !== null && !isStage && (
        <ControlledSeatBanner model={model.controlledSeat} />
      )}
      <div className="room-content">
        {content.kind === 'seats' ? (
          <div
            className="room-board-column"
            data-scroll-information={content.informationLayout === 'scroll-with-seats'}
          >
            {content.contextHeader !== null && (
              <div className="room-context-header">{content.contextHeader}</div>
            )}
            {statusInBoard && (
              <div className="room-board-information">
                <div className="room-board-status">
                  <RoomActionStatus
                    model={model.playerActions}
                    summary={content.bottomSummary}
                    isAudioPlaying={model.isAudioPlaying}
                    hostManagement={hostManagement}
                    selectionMode={selectionMode}
                    boardStatus={{
                      phaseLabel,
                      summaryPresentation: content.summaryPresentation,
                      title: lobbyTitle,
                      detail:
                        lobbyAction !== null && seatsMissing > 0 ? `还差 ${seatsMissing} 人` : null,
                    }}
                  />
                </div>
                {content.beforeSeatBoard}
              </div>
            )}
            <div className="room-board-scroll">
              <RoomSeatBoard
                model={model.seats}
                header={statusInBoard ? null : content.beforeSeatBoard}
                footer={content.afterSeatBoard}
              />
            </div>
          </div>
        ) : content.kind === 'stage' ? (
          <RoomStageContent content={content} model={model} />
        ) : (
          <div className="room-workspace">{content.element}</div>
        )}
      </div>
      {hand !== null && (
        <RoomBottomActionPanel>
          {!statusInBoard && (
            <RoomActionStatus
              model={model.playerActions}
              summary={content.kind === 'seats' ? content.bottomSummary : null}
              isAudioPlaying={model.isAudioPlaying}
              hostManagement={hostManagement}
              selectionMode={selectionMode}
            />
          )}
          {hand.face.kind === 'host' && <RoomHostTaskHeader model={hostManagement} />}
          <RoomActionHand
            hand={hand}
            focusCardId={navigation.focus}
            onFocusRestored={navigation.clearFocus}
            onBack={navigation.back}
            testId={
              hand.face.kind === 'menu'
                ? TESTIDS.roomStageMenuPanel
                : hand.face.kind === 'host'
                  ? TESTIDS.roomHostManagementPanel
                  : undefined
            }
          />
        </RoomBottomActionPanel>
      )}
      {model.seatConfirmation !== null && <RoomSeatConfirmModal model={model.seatConfirmation} />}
      {model.profile !== null && (
        <PlayerProfileCard
          model={model.profile}
          roomCode={model.roomCode}
          {...(profileDetailsRenderer === undefined ? {} : { profileDetailsRenderer })}
        />
      )}
      <RoomShareDialog model={model.share} />
      {gameOverlays}
    </div>
  );
}
