/**
 * 「配置抽身份」弹窗（由预览中确认的 IdentitySetupDialog 提升而来）：「身份方案」折叠区、
 * 每种身份一个标签、「添加身份」，以及底部的每人抽牌数与牌数摘要。建房与房间设置共用。
 */
import './ToolboxIdentityEditor.css';

import {
  TOOLBOX_IDENTITY_LIMITS,
  type ToolboxIdentityConfig,
} from '@game-judge/game-engine/games/toolbox/public';
import { type ReactNode, useId, useState } from 'react';

import { Button } from '@/components/Button';
import { Stepper } from '@/components/Stepper';
import { TabList, TabPanel, Tabs } from '@/components/Tabs';
import { RoomDialog } from '@/features/room/components/RoomDialog';
import { confirmAction } from '@/features/room/confirm';
import { TESTIDS } from '@/testids';

import {
  countToolboxDraftCards,
  createToolboxIdentityDraft,
  findToolboxIdentityDraftProblem,
  parseToolboxCountInput,
  readToolboxIdentityDraft,
  type ToolboxIdentityDraft,
  type ToolboxIdentityRoleDraft,
} from './toolboxIdentityDraft';
import { ToolboxPresetSection } from './ToolboxPresetSection';

/** 编辑器的草稿、当前身份标签和底部提示；由弹窗持有。 */
export interface ToolboxIdentitySetupState {
  readonly draft: ToolboxIdentityDraft;
  readonly activeRoleId: string;
  readonly message: string;
  readonly update: (draft: ToolboxIdentityDraft) => void;
  readonly selectRole: (roleId: string) => void;
  /** 用载入的方案替换草稿并回到第一种身份。 */
  readonly replace: (config: ToolboxIdentityConfig) => void;
  readonly showMessage: (message: string) => void;
  /** 合法时返回配置；否则切到出错的身份并在底部说明。`playerCount` 为 null 时不核对张数。 */
  readonly validate: (playerCount: number | null) => ToolboxIdentityConfig | null;
}

function firstRoleId(draft: ToolboxIdentityDraft): string {
  const first = draft.roles[0];
  if (first === undefined) throw new Error('[FAIL-FAST] identity draft must keep one role');
  return String(first.id);
}

function useToolboxIdentitySetup(initial: ToolboxIdentityConfig): ToolboxIdentitySetupState {
  const [draft, setDraft] = useState(() => createToolboxIdentityDraft(initial));
  const [activeRoleId, setActiveRoleId] = useState(() => firstRoleId(draft));
  const [message, setMessage] = useState('');
  return {
    draft,
    activeRoleId,
    message,
    update: (next) => {
      setDraft(next);
      setMessage('');
    },
    selectRole: setActiveRoleId,
    replace: (config) => {
      const next = createToolboxIdentityDraft(config);
      setDraft(next);
      setActiveRoleId(firstRoleId(next));
      setMessage('');
    },
    showMessage: setMessage,
    validate: (playerCount) => {
      const problem = findToolboxIdentityDraftProblem(draft, playerCount);
      if (problem === null) return readToolboxIdentityDraft(draft);
      if (problem.roleId !== null) setActiveRoleId(String(problem.roleId));
      setMessage(problem.message);
      return null;
    },
  };
}

function IdentityRoleEditor({
  role,
  index,
  isRemovable,
  isDisabled,
  onChange,
  onRemove,
}: {
  readonly role: ToolboxIdentityRoleDraft;
  readonly index: number;
  readonly isRemovable: boolean;
  readonly isDisabled: boolean;
  readonly onChange: (role: ToolboxIdentityRoleDraft) => void;
  readonly onRemove: () => void;
}) {
  const prefix = useId();
  return (
    <fieldset className="toolbox-identity-role" disabled={isDisabled}>
      <legend>身份 {index + 1}</legend>
      <label htmlFor={`${prefix}-name`}>身份名称</label>
      <input
        id={`${prefix}-name`}
        value={role.name}
        maxLength={TOOLBOX_IDENTITY_LIMITS.nameMaxLength}
        autoComplete="off"
        onChange={(event) => onChange({ ...role, name: event.currentTarget.value })}
      />
      <label htmlFor={`${prefix}-description`}>身份说明（可选）</label>
      <textarea
        id={`${prefix}-description`}
        value={role.description}
        maxLength={TOOLBOX_IDENTITY_LIMITS.descriptionMaxLength}
        rows={2}
        onChange={(event) => onChange({ ...role, description: event.currentTarget.value })}
      />
      <div className="toolbox-identity-role-row">
        <div>
          <label htmlFor={`${prefix}-count`}>数量</label>
          <input
            id={`${prefix}-count`}
            type="number"
            inputMode="numeric"
            min={1}
            max={TOOLBOX_IDENTITY_LIMITS.maxCountPerIdentity}
            value={role.count}
            onChange={(event) => onChange({ ...role, count: event.currentTarget.value })}
          />
        </div>
        {isRemovable && (
          <Button variant="ghost" onClick={onRemove} aria-label={`删除身份 ${index + 1}`}>
            删除
          </Button>
        )}
      </div>
    </fieldset>
  );
}

/** 编辑区主体：方案折叠区、每种身份一个标签与「添加身份」。 */
function ToolboxIdentitySetup({
  setup,
  isAnonymous,
  isDisabled,
}: {
  readonly setup: ToolboxIdentitySetupState;
  readonly isAnonymous: boolean;
  readonly isDisabled: boolean;
}) {
  const { draft } = setup;
  const isFull = draft.roles.length >= TOOLBOX_IDENTITY_LIMITS.maxIdentityTypes;
  return (
    <div className="toolbox-identity-setup">
      <ToolboxPresetSection setup={setup} isAnonymous={isAnonymous} isDisabled={isDisabled} />
      <Tabs value={setup.activeRoleId} onValueChange={setup.selectRole}>
        <div className="toolbox-identity-tabs">
          <TabList
            label="身份"
            variant="underline"
            layout="scroll"
            items={draft.roles.map((role, index) => ({
              value: String(role.id),
              label: role.name.trim() || `身份 ${index + 1}`,
            }))}
          />
        </div>
        {draft.roles.map((role, index) => (
          <TabPanel key={role.id} value={String(role.id)}>
            <IdentityRoleEditor
              role={role}
              index={index}
              isRemovable={draft.roles.length > 1}
              isDisabled={isDisabled}
              onChange={(next) =>
                setup.update({
                  ...draft,
                  roles: draft.roles.map((item) => (item.id === role.id ? next : item)),
                })
              }
              onRemove={() => {
                const remaining = draft.roles.filter((item) => item.id !== role.id);
                const neighbour = remaining[Math.max(0, index - 1)];
                if (neighbour === undefined)
                  throw new Error('[FAIL-FAST] the last identity cannot be removed');
                setup.update({ ...draft, roles: remaining });
                setup.selectRole(String(neighbour.id));
              }}
            />
          </TabPanel>
        ))}
      </Tabs>
      <Button
        variant="outline"
        disabled={isDisabled || isFull}
        onClick={() => {
          const id = Math.max(...draft.roles.map((role) => role.id)) + 1;
          setup.update({
            ...draft,
            roles: [...draft.roles, { id, name: '', description: '', count: '1' }],
          });
          setup.selectRole(String(id));
        }}
      >
        {isFull ? `最多 ${TOOLBOX_IDENTITY_LIMITS.maxIdentityTypes} 种身份` : '添加身份'}
      </Button>
    </div>
  );
}

/** 编辑区底部：每人抽牌数、「共 N 张 · M 人需 K 张」、提示与操作按钮。 */
function ToolboxIdentitySetupFooter({
  setup,
  requirement,
  isDisabled,
  children,
}: {
  readonly setup: ToolboxIdentitySetupState;
  /** 准备阶段按已入座人数；建房时尚无人入座为 null。 */
  readonly requirement: { readonly playerCount: number; readonly label: string } | null;
  readonly isDisabled: boolean;
  readonly children: ReactNode;
}) {
  const { draft } = setup;
  const total = countToolboxDraftCards(draft);
  const perPlayer = parseToolboxCountInput(draft.cardsPerPlayer);
  const isPerPlayerValid = Number.isSafeInteger(perPlayer);
  const required =
    requirement === null || !isPerPlayerValid ? null : perPlayer * requirement.playerCount;
  const step = (delta: number) =>
    setup.update({ ...draft, cardsPerPlayer: String((isPerPlayerValid ? perPlayer : 1) + delta) });
  return (
    <div className="toolbox-identity-footer">
      <Stepper
        label="每人抽牌数量"
        entry={{
          kind: 'text',
          value: draft.cardsPerPlayer,
          onChangeText: (cardsPerPlayer) => setup.update({ ...draft, cardsPerPlayer }),
        }}
        onDecrement={() => step(-1)}
        onIncrement={() => step(1)}
        isDecrementDisabled={isDisabled || !isPerPlayerValid || perPlayer <= 1}
        isIncrementDisabled={
          isDisabled || !isPerPlayerValid || perPlayer >= TOOLBOX_IDENTITY_LIMITS.maxCardsPerPlayer
        }
        decrementLabel="减少每人抽牌数量"
        incrementLabel="增加每人抽牌数量"
        testId={TESTIDS.gameConfigField('toolbox', 'cardsPerPlayer')}
        decrementTestId={TESTIDS.gameConfigFieldDecrement('toolbox', 'cardsPerPlayer')}
        incrementTestId={TESTIDS.gameConfigFieldIncrement('toolbox', 'cardsPerPlayer')}
      />
      <p className="toolbox-identity-summary" aria-live="polite">
        共 {total} 张 ·{' '}
        {requirement === null
          ? '开始时按入座人数核对'
          : `${requirement.label}需 ${required ?? '—'} 张`}
      </p>
      {required !== null && total < required && (
        <p className="toolbox-identity-shortage">还差 {required - total} 张，请增加身份牌数量</p>
      )}
      {setup.message !== '' && (
        <p className="toolbox-identity-message" role="status">
          {setup.message}
        </p>
      )}
      {children}
    </div>
  );
}

/**
 * 「配置抽身份」弹窗：编辑副本，「完成」校验后交回设置页；取消或关闭时丢弃修改。
 * 张数不足不阻止完成：入座人数在开始前仍会变化，开始按钮会按当时人数说明。
 */
export function ToolboxIdentitySetupDialog({
  initial,
  requirement,
  isAnonymous,
  onDone,
  onClose,
}: {
  readonly initial: ToolboxIdentityConfig;
  readonly requirement: { readonly playerCount: number; readonly label: string } | null;
  readonly isAnonymous: boolean;
  readonly onDone: (identity: ToolboxIdentityConfig) => void;
  readonly onClose: () => void;
}) {
  const setup = useToolboxIdentitySetup(initial);
  const requestClose = () => {
    if (JSON.stringify(setup.draft) === JSON.stringify(createToolboxIdentityDraft(initial))) {
      onClose();
      return;
    }
    confirmAction({ label: '放弃修改？', body: '还没有保存此次修改。', onConfirm: onClose });
  };
  const done = () => {
    const identity = setup.validate(null);
    if (identity !== null) onDone(identity);
  };
  return (
    <RoomDialog
      title="配置抽身份"
      dismissOnEscape
      onClose={requestClose}
      footer={
        <ToolboxIdentitySetupFooter setup={setup} requirement={requirement} isDisabled={false}>
          <div className="toolbox-identity-footer-actions">
            <Button onClick={done} data-testid={TESTIDS.gameConfigSubmit('toolbox-identity')}>
              完成
            </Button>
            <Button variant="secondary" onClick={requestClose}>
              取消
            </Button>
          </div>
        </ToolboxIdentitySetupFooter>
      }
    >
      <ToolboxIdentitySetup setup={setup} isAnonymous={isAnonymous} isDisabled={false} />
    </RoomDialog>
  );
}
