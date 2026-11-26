/**
 * 「身份方案」折叠区（由预览中确认的 SavedConfigurations 提升而来）：选择方案载入、填写方案名称、
 * 保存新方案、更新或删除已选方案。方案保存在本人账号，匿名用户只看到登录提示。
 */
import {
  TOOLBOX_IDENTITY_LIMITS,
  type ToolboxIdentityConfig,
} from '@game-judge/game-engine/games/toolbox/public';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';

import { Button } from '@/components/Button';
import { confirmAction } from '@/features/room/confirm';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

import { isBlankToolboxIdentityDraft, readToolboxIdentityDraft } from './toolboxIdentityDraft';
import type { ToolboxIdentitySetupState } from './ToolboxIdentityEditor';
import {
  createToolboxPreset,
  deleteToolboxPreset,
  getToolboxPresetFailureMessage,
  type ToolboxPreset,
  toolboxPresetListOptions,
  updateToolboxPreset,
} from './toolboxPresetsApi';

type PresetMutation =
  | {
      readonly kind: 'create';
      readonly name: string;
      readonly identity: ToolboxIdentityConfig;
    }
  | {
      readonly kind: 'update';
      readonly preset: ToolboxPreset;
      readonly name: string;
      readonly identity: ToolboxIdentityConfig;
    }
  | { readonly kind: 'delete'; readonly preset: ToolboxPreset };

const MUTATION_LABELS: Readonly<Record<PresetMutation['kind'], string>> = {
  create: '保存身份方案',
  update: '更新身份方案',
  delete: '删除身份方案',
};

function reportPresetFailure(label: string, error: unknown): void {
  const message = getToolboxPresetFailureMessage(error);
  handleError(error, {
    label,
    logger: configLog,
    isExpected: () => message !== null,
    ...(message === null ? {} : { alertMessage: message }),
  });
}

function runPresetMutation(request: PresetMutation): Promise<ToolboxPreset | null> {
  switch (request.kind) {
    case 'create':
      return createToolboxPreset({ name: request.name, identity: request.identity });
    case 'update':
      return updateToolboxPreset({
        id: request.preset.id,
        name: request.name,
        identity: request.identity,
        expectedVersion: request.preset.version,
      });
    case 'delete':
      return deleteToolboxPreset(request.preset.id).then(() => null);
  }
}

function successMessage(request: PresetMutation): string {
  switch (request.kind) {
    case 'create':
      return `「${request.name}」已保存到账号。`;
    case 'update':
      return `「${request.name}」已更新。`;
    case 'delete':
      return `「${request.preset.name}」已删除。`;
  }
}

/** 身份方案折叠区；载入与保存都经过编辑器的 `setup`，保存前按引擎规则校验当前身份。 */
export function ToolboxPresetSection({
  setup,
  isAnonymous,
  isDisabled,
}: {
  readonly setup: ToolboxIdentitySetupState;
  readonly isAnonymous: boolean;
  readonly isDisabled: boolean;
}) {
  const choiceId = useId();
  const nameId = useId();
  const queryClient = useQueryClient();
  const presets = useQuery({ ...toolboxPresetListOptions, enabled: !isAnonymous });
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const mutation = useMutation({
    mutationFn: runPresetMutation,
    onSuccess: (saved, request) => {
      configLog.info('Toolbox preset mutation committed', { kind: request.kind });
      setSelectedId(saved?.id ?? '');
      setName(saved?.name ?? '');
      setup.showMessage(successMessage(request));
    },
    onError: (error, request) => reportPresetFailure(MUTATION_LABELS[request.kind], error),
    // 冲突和不存在都需要最新列表才能重试；成功后列表也已变化。
    onSettled: () => queryClient.invalidateQueries({ queryKey: toolboxPresetListOptions.queryKey }),
  });
  useEffect(() => {
    if (presets.error !== null) configLog.warn('Toolbox preset list failed', presets.error);
  }, [presets.error]);

  const saved = presets.data ?? [];
  const selected = saved.find((preset) => preset.id === selectedId) ?? null;
  const isBusy = isDisabled || mutation.isPending;
  const summaryCount = saved.length > 0 ? `（${saved.length} 套）` : '（可选）';

  const load = (preset: ToolboxPreset) => {
    const apply = () => {
      setSelectedId(preset.id);
      setName(preset.name);
      setup.replace(preset.identity);
    };
    const current = readToolboxIdentityDraft(setup.draft);
    if (
      isBlankToolboxIdentityDraft(setup.draft) ||
      JSON.stringify(current) === JSON.stringify(preset.identity)
    ) {
      apply();
      return;
    }
    confirmAction({
      label: '载入方案？',
      body: `当前编辑的身份会被「${preset.name}」替换，已保存的方案不受影响。`,
      confirmText: '载入',
      onConfirm: apply,
    });
  };
  const readSubmission = (): {
    readonly name: string;
    readonly identity: ToolboxIdentityConfig;
  } | null => {
    const identity = setup.validate(null);
    if (identity === null) return null;
    const trimmed = name.trim();
    if (trimmed === '') {
      setup.showMessage('请填写方案名称。');
      return null;
    }
    return { name: trimmed, identity };
  };
  const saveNew = () => {
    const submission = readSubmission();
    if (submission !== null) mutation.mutate({ kind: 'create', ...submission });
  };
  const updateSelected = (preset: ToolboxPreset) => {
    const submission = readSubmission();
    if (submission === null) return;
    confirmAction({
      label: '更新方案？',
      body:
        submission.name === preset.name
          ? `将用当前编辑的身份覆盖「${preset.name}」。`
          : `将用当前编辑的身份覆盖「${preset.name}」，并改名为「${submission.name}」。`,
      confirmText: '更新',
      onConfirm: () => mutation.mutate({ kind: 'update', preset, ...submission }),
    });
  };
  const deleteSelected = (preset: ToolboxPreset) =>
    confirmAction({
      label: '删除方案？',
      body: `删除「${preset.name}」后无法恢复，当前编辑的身份不受影响。`,
      tone: 'danger',
      confirmText: '删除',
      onConfirm: () => mutation.mutate({ kind: 'delete', preset }),
    });

  if (isAnonymous)
    return (
      <details className="toolbox-identity-saved">
        <summary>身份方案（可选）</summary>
        <p>登录后可保存和使用方案。</p>
      </details>
    );
  return (
    <details className="toolbox-identity-saved">
      <summary>身份方案{summaryCount}</summary>
      {presets.isPending ? (
        <p role="status">正在载入方案…</p>
      ) : presets.isError ? (
        <div role="alert">
          <p>方案列表加载失败</p>
          <Button variant="secondary" onClick={() => void presets.refetch()}>
            重试
          </Button>
        </div>
      ) : (
        saved.length > 0 && (
          <>
            <label htmlFor={choiceId}>使用已保存的方案</label>
            <select
              id={choiceId}
              value={selectedId}
              disabled={isBusy}
              onChange={(event) => {
                const preset = saved.find((item) => item.id === event.currentTarget.value);
                if (preset === undefined) {
                  setSelectedId('');
                  return;
                }
                load(preset);
              }}
            >
              <option value="">选择方案</option>
              {saved.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </>
        )
      )}
      <label htmlFor={nameId}>方案名称</label>
      <input
        id={nameId}
        value={name}
        maxLength={TOOLBOX_IDENTITY_LIMITS.nameMaxLength}
        autoComplete="off"
        disabled={isBusy}
        onChange={(event) => setName(event.currentTarget.value)}
      />
      <div className="toolbox-identity-inline-actions">
        <Button variant="secondary" disabled={isBusy} onClick={saveNew}>
          保存新方案
        </Button>
        {selected !== null && (
          <>
            <Button variant="secondary" disabled={isBusy} onClick={() => updateSelected(selected)}>
              更新已选方案
            </Button>
            <Button variant="ghost" disabled={isBusy} onClick={() => deleteSelected(selected)}>
              删除已选方案
            </Button>
          </>
        )}
      </div>
    </details>
  );
}
