/**
 * 聚会工具设置页：本次工具复选框；启用身份牌时显示「身份配置」入口卡，点击打开「配置抽身份」弹窗。
 * 建房走共享创建流程；准备阶段的房间设置读当前房间快照并提交 `toolbox.config.update`。
 */
import '@/features/room/config/GameConfigPage.css';
import './ToolboxConfigScreen.css';

import {
  countToolboxIdentityCards,
  DEFAULT_TOOLBOX_CONFIG,
  isUsableToolboxIdentityConfig,
  TOOLBOX_TOOLS,
  type ToolboxConfig,
  type ToolboxIdentityConfig,
  type ToolboxPublicCommand,
  type ToolboxTool,
  type ToolboxView,
} from '@game-judge/game-engine/games/toolbox/public';
import { type ComponentType, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuthContext } from '@/contexts/AuthContext';
import { RoomDialog } from '@/features/room/components/RoomDialog';
import type { GameConfigDialog } from '@/features/room/config/createGameConfigScreen';
import { confirmAction } from '@/features/room/confirm';
import { useRoomConfigSubmission } from '@/features/room/controllers/useRoomConfigSubmission';
import { useRoomLinkSnapshot } from '@/features/room/controllers/useRoomLinkSnapshot';
import { roomPath } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomLink } from '@/platform/realtime/types';
import { TESTIDS } from '@/testids';

import type { ToolboxRoomSession } from '../model/ToolboxRoomSession';
import { parseToolboxConfigRouteParams } from '../navigation/toolboxGameNavigation';
import { getToolboxRoomCommandFailureMessage } from '../room/toolboxRoomCommandFailureMessage';
import { ToolboxIdentitySetupDialog } from './ToolboxIdentityEditor';

const TOOL_OPTIONS: Readonly<
  Record<ToolboxTool, { readonly title: string; readonly detail: string }>
> = {
  dice: { title: '骰子', detail: '摇骰并固定点数' },
  identity: { title: '身份牌', detail: '配置身份牌，玩家自行抽取' },
};

/** 按规范顺序切换一项工具。 */
function toggleTool(tools: readonly ToolboxTool[], tool: ToolboxTool): ToolboxTool[] {
  const selected = tools.includes(tool)
    ? tools.filter((current) => current !== tool)
    : [...tools, tool];
  return TOOLBOX_TOOLS.filter((candidate) => selected.includes(candidate));
}

/** 准备阶段的房间设置只读取房主可编辑的快照；其余情况属于调用方错误。 */
function readEditableConfig(session: ToolboxRoomSession, roomCode: string): ToolboxView {
  const snapshot = session.getSnapshot();
  if (snapshot.phase !== 'ready' || snapshot.identity.room.roomCode !== roomCode)
    throw new Error('[FAIL-FAST] toolbox config edit requires its active room session');
  if (snapshot.room.state.phase.kind !== 'preparing')
    throw new Error('[FAIL-FAST] toolbox config can only be edited while preparing');
  return snapshot.room.state;
}

/** 设置页只在登录态（含匿名账号）下可达；缺少用户是路由守卫失效。 */
function requireSignedInUser<TUser>(user: TUser | null): TUser {
  if (user === null) throw new Error('[FAIL-FAST] toolbox config requires a signed-in user');
  return user;
}

/** 本次工具复选框（由预览中确认的 ToolOptions 提升而来）。 */
function ToolOptions({
  tools,
  isDisabled,
  onChange,
}: {
  readonly tools: readonly ToolboxTool[];
  readonly isDisabled: boolean;
  readonly onChange: (tools: ToolboxTool[]) => void;
}) {
  return (
    <fieldset className="toolbox-tool-options" disabled={isDisabled}>
      <legend>本次工具</legend>
      {TOOLBOX_TOOLS.map((tool) => (
        <label key={tool} className="toolbox-tool-option">
          <input
            type="checkbox"
            checked={tools.includes(tool)}
            onChange={() => onChange(toggleTool(tools, tool))}
            data-testid={TESTIDS.gameConfigField('toolbox', tool)}
          />
          <span>
            <strong>{TOOL_OPTIONS[tool].title}</strong>
            <small>{TOOL_OPTIONS[tool].detail}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** 「身份配置」入口卡：摘要当前身份与张数，点击打开「配置抽身份」弹窗。 */
function IdentityEntryCard({
  identity,
  seatedCount,
  isDisabled,
  onOpen,
}: {
  readonly identity: ToolboxIdentityConfig;
  readonly seatedCount: number | null;
  readonly isDisabled: boolean;
  readonly onOpen: () => void;
}) {
  const isConfigured = isUsableToolboxIdentityConfig(identity);
  const total = countToolboxIdentityCards(identity);
  const required = seatedCount === null ? null : seatedCount * identity.cardsPerPlayer;
  return (
    <button
      type="button"
      className="toolbox-identity-entry"
      disabled={isDisabled}
      onClick={onOpen}
      data-testid={TESTIDS.gameConfigField('toolbox', 'identityConfig')}
    >
      <span>
        <strong>身份配置</strong>
        {isConfigured ? (
          <>
            <small>
              {identity.identities.map(({ name, count }) => `${name}×${count}`).join('、')}
            </small>
            <small>
              共 {total} 张 · 每人抽 {identity.cardsPerPlayer} 张
              {required !== null && ` · 已入座 ${seatedCount} 人需 ${required} 张`}
            </small>
            {required !== null && total < required && (
              <small className="toolbox-identity-entry-shortage">
                还差 {required - total} 张，请增加身份牌数量
              </small>
            )}
          </>
        ) : (
          <small>还没有配置身份，点击配置</small>
        )}
      </span>
      <span className="toolbox-identity-entry-chevron" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

function ToolboxConfigPage({
  session,
  dialog,
}: {
  readonly session: RoomLink<ToolboxView, ToolboxPublicCommand>;
  readonly dialog?: GameConfigDialog;
}) {
  const routeParams = useParams();
  const params =
    dialog === undefined
      ? parseToolboxConfigRouteParams(routeParams)
      : { gameType: 'toolbox' as const, mode: 'edit' as const, roomCode: dialog.roomCode };
  const auth = useAuthContext();
  const user = requireSignedInUser(auth.user);
  const navigate = useNavigate();
  const [initial] = useState<{
    readonly config: ToolboxConfig;
    readonly seatedCount: number | null;
  }>(() => {
    if (params.mode === 'create') return { config: DEFAULT_TOOLBOX_CONFIG, seatedCount: null };
    const view = readEditableConfig(session, params.roomCode);
    return {
      config: view.config,
      seatedCount: view.phase.kind === 'preparing' ? view.phase.seatedCount : null,
    };
  });
  const [tools, setTools] = useState(initial.config.tools);
  const [identity, setIdentity] = useState(initial.config.identity);
  const [isIdentityDialogOpen, setIsIdentityDialogOpen] = useState(false);
  const snapshot = useRoomLinkSnapshot(session);
  const isEditAvailable =
    params.mode !== 'edit' ||
    (snapshot.phase === 'ready' &&
      snapshot.identity.room.roomCode === params.roomCode &&
      snapshot.room.state.hostUserId === user.id &&
      snapshot.room.state.phase.kind === 'preparing');
  const seatedCount =
    snapshot.phase === 'ready' && snapshot.room.state.phase.kind === 'preparing'
      ? snapshot.room.state.phase.seatedCount
      : initial.seatedCount;
  const isIdentityEnabled = tools.includes('identity');
  const isIdentityMissing = isIdentityEnabled && !isUsableToolboxIdentityConfig(identity);
  const submittedConfig = (): ToolboxConfig => ({ tools, identity });
  const submission = useRoomConfigSubmission<ToolboxView>({
    params,
    navigate,
    getFailureMessage: getToolboxRoomCommandFailureMessage,
    createRequest: () => ({
      expectedHostUserId: user.id,
      gameType: 'toolbox',
      config: { tools, identity },
    }),
    updateConfig: () =>
      session.dispatch(
        { type: 'toolbox.config.update', config: submittedConfig() },
        { controlledSeat: null, label: '保存设置', durable: false },
      ),
    creationLabel: '创建聚会工具房间',
    ...(dialog === undefined ? {} : { onEditSaved: dialog.onClose }),
  });
  const isDirty = JSON.stringify(submittedConfig()) !== JSON.stringify(initial.config);
  const isLocked = submission.isSubmitting || !isEditAvailable;
  const body = (
    <div className="toolbox-config">
      <ToolOptions tools={tools} isDisabled={isLocked} onChange={setTools} />
      {isIdentityEnabled && (
        <IdentityEntryCard
          identity={identity}
          seatedCount={seatedCount}
          isDisabled={isLocked}
          onOpen={() => setIsIdentityDialogOpen(true)}
        />
      )}
      {isIdentityDialogOpen && (
        <ToolboxIdentitySetupDialog
          initial={identity}
          requirement={
            seatedCount === null
              ? null
              : { playerCount: seatedCount, label: `已入座 ${seatedCount} 人` }
          }
          isAnonymous={user.isAnonymous}
          onDone={(next) => {
            setIdentity(next);
            setIsIdentityDialogOpen(false);
          }}
          onClose={() => setIsIdentityDialogOpen(false)}
        />
      )}
    </div>
  );
  const actions = (
    <>
      {!isEditAvailable && <p role="status">房间状态或权限已变化，不能保存设置。</p>}
      {tools.length === 0 && (
        <p className="toolbox-config-blocker" role="status">
          请至少选择一个工具
        </p>
      )}
      {isIdentityMissing && (
        <p className="toolbox-config-blocker" role="status">
          请先配置身份牌
        </p>
      )}
      <Button
        size="lg"
        fullWidth
        disabled={tools.length === 0 || isIdentityMissing || !isEditAvailable}
        loading={submission.isSubmitting}
        onClick={submission.submit}
        data-testid={TESTIDS.gameConfigSubmit('toolbox')}
      >
        {params.mode === 'edit' ? '保存设置' : '创建房间'}
      </Button>
    </>
  );
  const footer = <div className="toolbox-config-footer">{actions}</div>;
  if (dialog !== undefined) {
    const requestClose = () => {
      if (submission.isSubmitting) return;
      if (isDirty)
        confirmAction({
          label: '放弃修改？',
          body: '还没有保存此次修改。',
          onConfirm: dialog.onClose,
        });
      else dialog.onClose();
    };
    return (
      <RoomDialog title="房间设置" onClose={requestClose} dismissOnEscape footer={footer}>
        {body}
      </RoomDialog>
    );
  }
  return (
    <div className="game-config-page" data-testid={TESTIDS.configScreenRoot}>
      <ScreenHeader
        title="聚会工具设置"
        parentPath={params.mode === 'create' ? '/games' : roomPath(params.roomCode)}
        backTestId={TESTIDS.configBackButton}
      />
      <main className="game-config-body" data-testid={TESTIDS.gameConfigScreenRoot('toolbox')}>
        {body}
      </main>
      <footer className="game-config-footer">{footer}</footer>
    </div>
  );
}

export const ToolboxConfigScreen: ComponentType<{
  readonly session: RoomLink<ToolboxView, ToolboxPublicCommand>;
  readonly dialog?: GameConfigDialog;
}> = ToolboxConfigPage;
