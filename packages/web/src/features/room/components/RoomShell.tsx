/** Shared visual frame for every game room. Game adapters provide models and explicit slots. */
import './RoomShell.css';

import {
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from 'react';

import { Avatar } from '@/components/avatar/Avatar';
import { IconButton } from '@/components/IconButton';
import { useLongPress } from '@/features/room/hooks/useLongPress';
import { useViewportWidth } from '@/features/room/hooks/useViewportWidth';
import { HOST_MANAGEMENT_LABEL } from '@/features/room/model/RoomHostManagement';
import { usesRoomSideInspector } from '@/features/room/model/roomShellLayout';
import type { RoomHeaderUserAction, RoomShellModel } from '@/features/room/model/RoomShellModel';
import { assertRoomStageShellModel, type RoomStageHudModel } from '@/features/room/model/RoomStage';
import { TESTIDS } from '@/testids';
import IconChevronBack from '~icons/ion/chevron-back';
import IconPersonCircleOutline from '~icons/ion/person-circle-outline';
import IconShareOutline from '~icons/ion/share-outline';

import { PlayerProfileCard } from './PlayerProfileCard';
import { RoomBottomActionPanel } from './RoomBottomActionPanel';
import { resolveRoomBottomActionPresentation } from './RoomBottomActionPresentation';
import { RoomHostManagementPanel } from './RoomHostManagementPanel';
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
      readonly beforeSeatBoard: ReactElement;
      readonly afterSeatBoard: ReactElement | null;
      readonly sideInspector: ReactElement | null;
    }
  | { readonly kind: 'workspace'; readonly element: ReactElement }
  /**
   * An in-play stage (docs/room-stage-layout-design.md): the information bar over the game's
   * element, host management in the header, and no bottom panel.
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
  const share = model.capabilities.canShareRoom;
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
      {share.isAllowed && (
        <IconButton
          label="分享房间"
          className="room-header-share"
          icon={<IconShareOutline aria-hidden />}
          onClick={share.execute}
          data-testid={TESTIDS.roomShareButton}
        />
      )}
    </div>
  );
}

export function RoomShell({
  model,
  content,
  leadingExtraActions,
  trailingExtraActions,
  configurationEntry,
  manualEntries,
  showPlayerHand = false,
  gameOverlays,
  profileDetailsRenderer,
}: {
  readonly model: RoomShellModel;
  readonly content: RoomShellContent;
  readonly leadingExtraActions: ReactNode;
  readonly trailingExtraActions: ReactNode;
  readonly configurationEntry?: { readonly onOpen: () => void } | null;
  readonly manualEntries?: ComponentProps<typeof RoomBottomActionPanel>['manualEntries'];
  readonly showPlayerHand?: boolean;
  readonly gameOverlays: ReactNode;
  /** Renders the profile card's game-specific stats section when the model carries gameDetails. */
  readonly profileDetailsRenderer?: (
    statsUserId: string,
    onGamesPlayedChange: (gamesPlayed: number | null) => void,
  ) => ReactNode;
}) {
  const isWideLayout = usesRoomSideInspector(useViewportWidth());
  const [isActionsPanelOpen, setIsActionsPanelOpen] = useState(false);
  const restoreHostEntryFocus = useRef(false);
  const hostEntryRef = useCallback((button: HTMLButtonElement | null) => {
    if (button === null || !restoreHostEntryFocus.current) return;
    restoreHostEntryFocus.current = false;
    button.focus({ preventScroll: true });
  }, []);
  const hostManagement = model.hostManagement;
  const isStage = content.kind === 'stage';
  const bottomActions = isStage ? null : model.bottomActions;
  const panelPlayerActions = showPlayerHand ? null : bottomActions;
  const hasAdditionalPlayerActions =
    panelPlayerActions !== null &&
    resolveRoomBottomActionPresentation(panelPlayerActions).additionalActions.length > 0;
  const canOpenActionsPanel = hostManagement !== null || hasAdditionalPlayerActions;
  if (isActionsPanelOpen && !canOpenActionsPanel) {
    setIsActionsPanelOpen(false);
  }
  if (isStage) assertRoomStageShellModel(model);
  const openActionsPanel = () => {
    if (!canOpenActionsPanel) throw new Error('Cannot open unavailable room actions panel');
    setIsActionsPanelOpen(true);
  };
  const closeActionsPanel = () => setIsActionsPanelOpen(false);
  const isActionsPanelShown = isActionsPanelOpen && canOpenActionsPanel;
  const isHostHandShown = isActionsPanelShown && showPlayerHand && !isStage;

  const sideInspector =
    isActionsPanelShown && !isHostHandShown ? (
      <RoomHostManagementPanel
        model={hostManagement}
        bottomActions={panelPlayerActions}
        presentation="inspector"
        onClose={closeActionsPanel}
        isAudioPlaying={model.isAudioPlaying}
      />
    ) : content.kind === 'seats' ? (
      content.sideInspector
    ) : null;

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
          {isStage && hostManagement !== null && (
            <button
              type="button"
              className="room-header-host-button"
              aria-haspopup="dialog"
              onClick={openActionsPanel}
              data-testid={TESTIDS.roomHostManagementButton}
            >
              {HOST_MANAGEMENT_LABEL}
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
          <div className="room-board-column">
            {content.contextHeader !== null && (
              <div className="room-context-header">{content.contextHeader}</div>
            )}
            <div className="room-board-scroll">
              <RoomSeatBoard
                model={model.seats}
                header={content.beforeSeatBoard}
                footer={content.afterSeatBoard}
              />
            </div>
          </div>
        ) : content.kind === 'stage' ? (
          <RoomStageContent content={content} model={model} />
        ) : (
          <div className="room-workspace">{content.element}</div>
        )}
        {isWideLayout && sideInspector}
      </div>
      {!isStage && (
        <RoomBottomActionPanel
          model={model.bottomActions}
          summary={content.kind === 'seats' ? content.bottomSummary : null}
          isAudioPlaying={model.isAudioPlaying}
          hostManagement={hostManagement}
          onOpenMoreActions={openActionsPanel}
          configurationEntry={configurationEntry}
          manualEntries={manualEntries}
          showPlayerHand={showPlayerHand}
          hostEntryRef={hostEntryRef}
          hostHand={
            isHostHandShown ? (
              <RoomHostManagementPanel
                model={hostManagement}
                bottomActions={null}
                presentation="hand"
                onClose={closeActionsPanel}
                onBack={() => {
                  restoreHostEntryFocus.current = true;
                  closeActionsPanel();
                }}
                isAudioPlaying={model.isAudioPlaying}
              />
            ) : null
          }
        />
      )}
      {isActionsPanelShown && !isHostHandShown && !isWideLayout && (
        <RoomHostManagementPanel
          model={hostManagement}
          bottomActions={panelPlayerActions}
          presentation="sheet"
          onClose={closeActionsPanel}
          isAudioPlaying={model.isAudioPlaying}
        />
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
