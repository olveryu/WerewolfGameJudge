/** Shared visual frame for every game room. Game adapters provide models and explicit slots. */
import './RoomShell.css';

import { type ReactElement, type ReactNode, useState } from 'react';

import { Avatar } from '@/components/avatar/Avatar';
import { IconButton } from '@/components/IconButton';
import { useLongPress } from '@/features/room/hooks/useLongPress';
import { useViewportWidth } from '@/features/room/hooks/useViewportWidth';
import { usesRoomSideInspector } from '@/features/room/model/roomShellLayout';
import type { RoomHeaderUserAction, RoomShellModel } from '@/features/room/model/RoomShellModel';
import { TESTIDS } from '@/testids';
import IconChevronBack from '~icons/ion/chevron-back';
import IconPersonCircleOutline from '~icons/ion/person-circle-outline';
import IconShareOutline from '~icons/ion/share-outline';

import { PlayerProfileCard } from './PlayerProfileCard';
import { RoomBottomActionPanel } from './RoomBottomActionPanel';
import { RoomHostManagementPanel } from './RoomHostManagementPanel';
import { RoomSeatBoard } from './RoomSeatBoard';
import { RoomShareDialog } from './RoomShareDialog';
import { ConnectionStatusBar, ControlledSeatBanner, RoomSeatConfirmModal } from './RoomStatusBars';

const TITLE_LONG_PRESS_MS = 1000;
const TICKET_BADGE_MAX = 99;

type RoomShellContent =
  | {
      readonly kind: 'seats';
      readonly contextHeader: ReactElement | null;
      readonly beforeSeatBoard: ReactElement;
      readonly afterSeatBoard: ReactElement | null;
      readonly sideInspector: ReactElement | null;
    }
  | { readonly kind: 'workspace'; readonly element: ReactElement };

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
  gameOverlays,
  profileDetailsRenderer,
}: {
  readonly model: RoomShellModel;
  readonly content: RoomShellContent;
  readonly leadingExtraActions: ReactNode;
  readonly trailingExtraActions: ReactNode;
  readonly gameOverlays: ReactNode;
  /** Renders the profile card's game-specific stats section when the model carries gameDetails. */
  readonly profileDetailsRenderer?: (statsUserId: string) => ReactNode;
}) {
  const isWideLayout = usesRoomSideInspector(useViewportWidth());
  const [isHostManagementOpen, setIsHostManagementOpen] = useState(false);
  const hostManagement = model.hostManagement;
  const openHostManagement = () => {
    if (hostManagement === null) throw new Error('Cannot open unavailable Host management');
    setIsHostManagementOpen(true);
  };
  const closeHostManagement = () => setIsHostManagementOpen(false);
  const isHostManagementShown = isHostManagementOpen && hostManagement !== null;

  const sideInspector = isHostManagementShown ? (
    <RoomHostManagementPanel
      model={hostManagement}
      presentation="inspector"
      onClose={closeHostManagement}
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
          {model.header.userAction !== null && <RoomUserButton action={model.header.userAction} />}
        </div>
      </header>
      {/* Banner slot: the connection bar first (nothing while live), then a bot-seat takeover. */}
      <ConnectionStatusBar
        status={model.connection.status}
        pendingDurableCount={model.connection.pendingDurableCount}
        onRetryNow={model.connection.onRetryNow}
      />
      {model.controlledSeat !== null && <ControlledSeatBanner model={model.controlledSeat} />}
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
        ) : (
          <div className="room-workspace">{content.element}</div>
        )}
        {isWideLayout && sideInspector}
      </div>
      <RoomBottomActionPanel
        model={model.bottomActions}
        isAudioPlaying={model.isAudioPlaying}
        hostManagement={hostManagement}
        onOpenHostManagement={openHostManagement}
      />
      {isHostManagementShown && !isWideLayout && (
        <RoomHostManagementPanel
          model={hostManagement}
          presentation="sheet"
          onClose={closeHostManagement}
        />
      )}
      {model.seatConfirmation !== null && <RoomSeatConfirmModal model={model.seatConfirmation} />}
      {model.profile !== null && (
        <PlayerProfileCard
          model={model.profile}
          {...(profileDetailsRenderer === undefined ? {} : { profileDetailsRenderer })}
        />
      )}
      <RoomShareDialog model={model.share} />
      {gameOverlays}
    </div>
  );
}
