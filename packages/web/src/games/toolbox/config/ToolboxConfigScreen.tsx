/**
 * 聚会工具设置页：工具选择卡与身份配置工作区。
 * 建房走共享创建流程；准备阶段的房间设置读当前房间快照并提交 `toolbox.config.update`。
 */
import '@/features/room/config/GameConfigPage.css';
import './ToolboxConfigScreen.css';

import {
  DEFAULT_TOOLBOX_CONFIG,
  isUsableToolboxIdentityConfig,
  TOOLBOX_TOOLS,
  type ToolboxConfig,
  type ToolboxPublicCommand,
  type ToolboxTool,
  type ToolboxView,
} from '@game-judge/game-engine/games/toolbox/public';
import { type ComponentType, type ReactNode, useState } from 'react';
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
import IonAlbumsOutline from '~icons/ion/albums-outline';
import IonCheckmarkCircle from '~icons/ion/checkmark-circle';
import IonDiceOutline from '~icons/ion/dice-outline';
import IonEllipseOutline from '~icons/ion/ellipse-outline';

import type { ToolboxRoomSession } from '../model/ToolboxRoomSession';
import { parseToolboxConfigRouteParams } from '../navigation/toolboxGameNavigation';
import { getToolboxRoomCommandFailureMessage } from '../room/toolboxRoomCommandFailureMessage';
import { ToolboxIdentityEditor, ToolboxIdentitySummary } from './ToolboxIdentityEditor';

const TOOL_CARDS: Readonly<
  Record<ToolboxTool, { readonly title: string; readonly detail: string; readonly icon: ReactNode }>
> = {
  dice: {
    title: '骰子',
    detail: '每人一个骰盅：摇、掀开、固定',
    icon: <IonDiceOutline aria-hidden="true" />,
  },
  identity: {
    title: '身份牌',
    detail: '配置身份，大家从同一牌堆各自抽取',
    icon: <IonAlbumsOutline aria-hidden="true" />,
  },
};

/** 按规范顺序切换一项工具。 */
function toggleTool(tools: readonly ToolboxTool[], tool: ToolboxTool): ToolboxTool[] {
  const selected = tools.includes(tool)
    ? tools.filter((current) => current !== tool)
    : [...tools, tool];
  return TOOLBOX_TOOLS.filter((candidate) => selected.includes(candidate));
}

/** 未通过时返回不可提交的原因；服务端仍做同样的校验。 */
function findToolboxConfigBlocker(config: ToolboxConfig): string | null {
  if (config.tools.length === 0) return '请至少选择一个工具';
  if (config.tools.includes('identity') && !isUsableToolboxIdentityConfig(config.identity))
    return '请添加至少一种身份';
  return null;
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

function ToolSelector({
  tools,
  isDisabled,
  onChange,
}: {
  readonly tools: readonly ToolboxTool[];
  readonly isDisabled: boolean;
  readonly onChange: (tools: ToolboxTool[]) => void;
}) {
  return (
    <fieldset className="toolbox-tool-selector">
      <legend>本次使用的工具</legend>
      <div>
        {TOOLBOX_TOOLS.map((tool) => {
          const isSelected = tools.includes(tool);
          const card = TOOL_CARDS[tool];
          return (
            <button
              key={tool}
              type="button"
              className="toolbox-tool-card"
              aria-pressed={isSelected}
              disabled={isDisabled}
              onClick={() => onChange(toggleTool(tools, tool))}
            >
              <span className="toolbox-tool-card-icon">{card.icon}</span>
              <span className="toolbox-tool-card-text">
                <strong>{card.title}</strong>
                <small>{card.detail}</small>
              </span>
              <span className="toolbox-tool-card-mark" aria-hidden="true">
                {isSelected ? <IonCheckmarkCircle /> : <IonEllipseOutline />}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
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
  const [config, setConfig] = useState(initial.config);
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
  const submission = useRoomConfigSubmission<ToolboxView>({
    params,
    navigate,
    getFailureMessage: getToolboxRoomCommandFailureMessage,
    createRequest: () => ({
      expectedHostUserId: user.id,
      gameType: 'toolbox',
      config: { tools: config.tools, identity: config.identity },
    }),
    updateConfig: () =>
      session.dispatch(
        { type: 'toolbox.config.update', config },
        { controlledSeat: null, label: '保存设置', durable: false },
      ),
    creationLabel: '创建聚会工具房间',
    ...(dialog === undefined ? {} : { onEditSaved: dialog.onClose }),
  });
  const blocker = findToolboxConfigBlocker(config);
  const isDirty = JSON.stringify(config) !== JSON.stringify(initial.config);
  const isIdentityEnabled = config.tools.includes('identity');
  const isLocked = submission.isSubmitting || !isEditAvailable;
  const body = (
    <div className="toolbox-config">
      <ToolSelector
        tools={config.tools}
        isDisabled={isLocked}
        onChange={(tools) => setConfig({ ...config, tools })}
      />
      {isIdentityEnabled && (
        <section
          className="toolbox-config-identity"
          aria-labelledby="toolbox-config-identity-title"
        >
          <h2 id="toolbox-config-identity-title">身份牌设置</h2>
          <ToolboxIdentityEditor
            value={config.identity}
            onChange={(identity) => setConfig({ ...config, identity })}
            isAnonymous={user.isAnonymous}
            isDisabled={isLocked}
          />
        </section>
      )}
    </div>
  );
  const footer = (
    <div className="toolbox-config-footer">
      {isIdentityEnabled && (
        <ToolboxIdentitySummary
          value={config.identity}
          onCardsPerPlayerChange={(cardsPerPlayer) =>
            setConfig({ ...config, identity: { ...config.identity, cardsPerPlayer } })
          }
          requirement={
            seatedCount === null
              ? null
              : { playerCount: seatedCount, label: `按已入座 ${seatedCount} 人` }
          }
          isDisabled={isLocked}
        />
      )}
      {!isEditAvailable && <p role="status">房间状态或权限已变化，不能保存设置。</p>}
      {blocker !== null && (
        <p className="toolbox-config-blocker" role="status">
          {blocker}
        </p>
      )}
      <Button
        size="lg"
        className="game-config-submit"
        disabled={blocker !== null || !isEditAvailable}
        loading={submission.isSubmitting}
        onClick={submission.submit}
        data-testid={TESTIDS.gameConfigSubmit('toolbox')}
      >
        {params.mode === 'edit' ? '保存设置' : '创建房间'}
      </Button>
    </div>
  );
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
