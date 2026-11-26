/**
 * 组装共享房间控制器与聚会工具的观看者视图；Screen 只消费本接口渲染。
 */

import type {
  ToolboxPublicCommand,
  ToolboxView,
} from '@game-judge/game-engine/games/toolbox/public';
import { useEffect, useRef, useState } from 'react';

import type { User } from '@/contexts/AuthContext';
import {
  type ReadyRoomSession,
  useReadyRoomSession,
} from '@/features/room/controllers/useReadyRoomSession';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomPresentationController } from '@/features/room/controllers/useRoomPresentationController';
import { useRoomProfileController } from '@/features/room/controllers/useRoomProfileController';
import { createViewProfilesCapability } from '@/features/room/model/RoomCapabilities';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';

import type { ToolboxRoomSession } from '../model/ToolboxRoomSession';
import {
  createToolboxCapabilities,
  createToolboxHostManagement,
  createToolboxPlayerActions,
  createToolboxRoomShellModel,
  type ToolboxRoomDialog,
} from './toolboxRoomAdapter';
import { getToolboxRoomCommandFailureMessage } from './toolboxRoomCommandFailureMessage';

/** 房间 Screen 的显式契约。 */
export interface ToolboxRoomScreenState {
  readonly view: ToolboxView;
  readonly user: User;
  readonly shellModel: RoomShellModel;
  readonly submit: ReadyRoomSession<ToolboxView, ToolboxPublicCommand>['submit'];
  /** 有命令在途或连接不可提交时为 true。 */
  readonly isLocked: boolean;
  readonly openOwnProfile: () => void;
  /** 本次使用中打开的工具箱弹窗；准备阶段恒为 null。 */
  readonly dialog: ToolboxRoomDialog | null;
  readonly openDialog: (dialog: ToolboxRoomDialog) => void;
  readonly closeDialog: () => void;
}

/** 弹窗绑定打开它的那次使用；结束或重新开始后旧弹窗不会再出现。 */
function useToolboxDialog(view: ToolboxView) {
  const [opened, setOpened] = useState<{
    readonly sessionId: string;
    readonly dialog: ToolboxRoomDialog;
  } | null>(null);
  const sessionId = view.phase.kind === 'active' ? view.phase.sessionId : null;
  const dialog = opened !== null && opened.sessionId === sessionId ? opened.dialog : null;
  const openDialog = (next: ToolboxRoomDialog) => {
    if (sessionId === null)
      throw new Error(`[FAIL-FAST] toolbox dialog ${next} requires an active session`);
    setOpened({ sessionId, dialog: next });
  };
  return { dialog, openDialog, closeDialog: () => setOpened(null) };
}

/** 进入房间即以账号成为成员；成员身份决定能否入座。 */
function useToolboxMembership(
  view: ToolboxView,
  isLive: boolean,
  submit: ToolboxRoomScreenState['submit'],
): void {
  const joinRequestedRef = useRef(false);
  useEffect(() => {
    if (view.isViewerMember || !isLive || joinRequestedRef.current) return;
    joinRequestedRef.current = true;
    void submit('进入房间', { type: 'toolbox.member.join' }, { actionKey: null }).then(
      (isJoined) => {
        if (!isJoined) joinRequestedRef.current = false;
      },
    );
  }, [isLive, submit, view.isViewerMember]);
}

/** 把当前就绪 session 绑定到房间壳控制器与命令上。 */
export function useToolboxRoomState(
  props: GameRoomScreenProps<'toolbox'> & {
    readonly session: ToolboxRoomSession;
    readonly entryController: RoomEntryController;
  },
): ToolboxRoomScreenState {
  const { room, entryController } = props;
  const { user, state, submit, isSubmitting, pendingActionKey } = useReadyRoomSession(
    props.session,
    getToolboxRoomCommandFailureMessage,
  );
  const dialogs = useToolboxDialog(state);
  const isHost = state.hostUserId === user.id;
  const isLive = entryController.connection.status.kind === 'live';
  useToolboxMembership(state, isLive, submit);
  const { share, titleActions, gachaStatus } = useRoomPresentationController({
    roomCode: room.roomCode,
    gameDisplayName: '聚会工具',
    isHost,
    entryReason: props.entryReason,
  });
  const profile = useRoomProfileController<ToolboxView>({ myUserId: user.id });
  const capabilities = createToolboxCapabilities({
    view: state,
    configureGame: props.onOpenRoomSettings,
    canViewProfiles: createViewProfilesCapability(true, profile.open),
    shareRoom: share.open,
  });
  const leaveRoom = () => {
    if (!state.isViewerMember || isSubmitting) {
      entryController.requestExit(false);
      return;
    }
    void submit('离开房间', { type: 'toolbox.member.leave' }, { actionKey: null }).then(
      (isLeft) => {
        if (isLeft) entryController.requestExit(false);
      },
    );
  };
  const shellModel = createToolboxRoomShellModel({
    view: state,
    roomCode: room.roomCode,
    isSubmitting,
    pendingActionKey,
    capabilities,
    onBack: leaveRoom,
    onTitlePress: titleActions.handleTitlePress,
    onTitleLongPress: titleActions.handleTitleLongPress,
    user,
    gachaStatus,
    onUserActionPress: props.onOpenUserSettings,
    connection: entryController.connection,
    share,
    playerActions: createToolboxPlayerActions({
      view: state,
      isSubmitting,
      pendingActionKey,
      submit,
      openDialog: dialogs.openDialog,
    }),
    profileSelection: profile.selection,
    onProfileClose: profile.close,
    buildHostManagement: () =>
      createToolboxHostManagement({
        view: state,
        capabilities,
        isSubmitting,
        pendingActionKey,
        submit,
        openDialog: dialogs.openDialog,
      }),
  });
  return {
    view: state,
    user,
    shellModel,
    submit,
    isLocked: isSubmitting || !isLive,
    openOwnProfile: () =>
      profile.open({
        seat: null,
        occupant: { kind: 'human', userId: user.id },
        rosterName: user.displayName ?? '匿名玩家',
      }),
    ...dialogs,
  };
}
