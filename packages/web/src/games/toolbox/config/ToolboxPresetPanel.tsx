/** 「已保存方案」标签：本人账号的身份方案列表、载入、另存、覆盖、重命名与删除。 */
import {
  isUsableToolboxIdentityConfig,
  type ToolboxIdentityConfig,
} from '@game-judge/game-engine/games/toolbox/public';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';

import { Button } from '@/components/Button';
import { confirmAction } from '@/features/room/confirm';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

import {
  createToolboxPreset,
  deleteToolboxPreset,
  getToolboxPresetFailureMessage,
  type ToolboxPreset,
  toolboxPresetListOptions,
  updateToolboxPreset,
} from './toolboxPresetsApi';

export interface ToolboxPresetPanelProps {
  readonly draft: ToolboxIdentityConfig;
  readonly isDisabled: boolean;
  readonly onLoad: (identity: ToolboxIdentityConfig) => void;
}

function isSameIdentityConfig(left: ToolboxIdentityConfig, right: ToolboxIdentityConfig): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function reportPresetFailure(label: string, error: unknown): void {
  const message = getToolboxPresetFailureMessage(error);
  handleError(error, {
    label,
    logger: configLog,
    isExpected: () => message !== null,
    ...(message === null ? {} : { alertMessage: message }),
  });
}

type PresetMutation =
  | { readonly kind: 'create'; readonly name: string }
  | { readonly kind: 'overwrite'; readonly preset: ToolboxPreset }
  | { readonly kind: 'rename'; readonly preset: ToolboxPreset; readonly name: string }
  | { readonly kind: 'delete'; readonly preset: ToolboxPreset };

const MUTATION_LABELS: Readonly<Record<PresetMutation['kind'], string>> = {
  create: '保存方案',
  overwrite: '覆盖方案',
  rename: '重命名方案',
  delete: '删除方案',
};

/** 账号方案只在正式账号下渲染；匿名提示由编辑器负责。 */
export function ToolboxPresetPanel({ draft, isDisabled, onLoad }: ToolboxPresetPanelProps) {
  const nameInputId = useId();
  const queryClient = useQueryClient();
  const presets = useQuery(toolboxPresetListOptions);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ readonly id: string; readonly name: string } | null>(
    null,
  );
  const mutation = useMutation({
    mutationFn: async (request: PresetMutation): Promise<void> => {
      switch (request.kind) {
        case 'create':
          await createToolboxPreset({ name: request.name, identity: draft });
          return;
        case 'overwrite':
          await updateToolboxPreset({
            id: request.preset.id,
            name: request.preset.name,
            identity: draft,
            expectedVersion: request.preset.version,
          });
          return;
        case 'rename':
          await updateToolboxPreset({
            id: request.preset.id,
            name: request.name,
            identity: request.preset.identity,
            expectedVersion: request.preset.version,
          });
          return;
        case 'delete':
          await deleteToolboxPreset(request.preset.id);
          return;
      }
    },
    onSuccess: (_, request) => {
      configLog.info('Toolbox preset mutation committed', { kind: request.kind });
      if (request.kind === 'create') setNewName('');
      if (request.kind === 'rename') setRenaming(null);
    },
    onError: (error, request) => reportPresetFailure(MUTATION_LABELS[request.kind], error),
    // 冲突和不存在都需要最新列表才能重试；成功后列表也已变化。
    onSettled: () => queryClient.invalidateQueries({ queryKey: toolboxPresetListOptions.queryKey }),
  });
  useEffect(() => {
    if (presets.error !== null) configLog.warn('Toolbox preset list failed', presets.error);
  }, [presets.error]);
  const isBusy = isDisabled || mutation.isPending;
  const canSaveDraft = isUsableToolboxIdentityConfig(draft);
  const load = (preset: ToolboxPreset) => {
    if (draft.identities.length === 0 || isSameIdentityConfig(draft, preset.identity)) {
      onLoad(preset.identity);
      return;
    }
    confirmAction({
      label: '载入方案？',
      body: `当前编辑的身份会被「${preset.name}」替换，已保存的方案不受影响。`,
      confirmText: '载入',
      onConfirm: () => onLoad(preset.identity),
    });
  };
  return (
    <div className="toolbox-preset-panel">
      <form
        className="toolbox-preset-create"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate({ kind: 'create', name: newName });
        }}
      >
        <label htmlFor={nameInputId}>把当前身份另存为新方案</label>
        <div>
          <input
            id={nameInputId}
            value={newName}
            placeholder="方案名称"
            autoComplete="off"
            disabled={isBusy || !canSaveDraft}
            onChange={(event) => setNewName(event.currentTarget.value)}
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={isBusy || !canSaveDraft || newName.trim().length === 0}
          >
            另存
          </Button>
        </div>
        {!canSaveDraft && <p className="toolbox-preset-hint">先添加身份再保存方案</p>}
      </form>
      {presets.isPending ? (
        <p className="toolbox-identity-empty-state" role="status">
          正在载入方案…
        </p>
      ) : presets.isError ? (
        <div className="toolbox-identity-empty-state" role="alert">
          <p>方案列表加载失败</p>
          <Button variant="secondary" onClick={() => void presets.refetch()}>
            重试
          </Button>
        </div>
      ) : presets.data.length === 0 ? (
        <p className="toolbox-identity-empty-state">还没有保存的方案</p>
      ) : (
        <ul className="toolbox-preset-list">
          {presets.data.map((preset) => (
            <li key={preset.id} className="toolbox-preset-item">
              {renaming?.id === preset.id ? (
                <form
                  className="toolbox-preset-rename"
                  onSubmit={(event) => {
                    event.preventDefault();
                    mutation.mutate({ kind: 'rename', preset, name: renaming.name });
                  }}
                >
                  <input
                    aria-label={`「${preset.name}」的新名称`}
                    value={renaming.name}
                    autoComplete="off"
                    disabled={isBusy}
                    onChange={(event) =>
                      setRenaming({ id: preset.id, name: event.currentTarget.value })
                    }
                  />
                  <Button type="submit" size="sm" disabled={isBusy}>
                    保存名称
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>
                    取消
                  </Button>
                </form>
              ) : (
                <div className="toolbox-preset-heading">
                  <strong>{preset.name}</strong>
                  <span>
                    {preset.identity.identities.length} 种身份 · 每人抽{' '}
                    {preset.identity.cardsPerPlayer} 张
                  </span>
                </div>
              )}
              <div className="toolbox-preset-actions">
                <Button size="sm" disabled={isBusy} onClick={() => load(preset)}>
                  载入
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isBusy || !canSaveDraft}
                  onClick={() =>
                    confirmAction({
                      label: '覆盖方案？',
                      body: `将用当前编辑的身份覆盖「${preset.name}」。`,
                      confirmText: '覆盖',
                      onConfirm: () => mutation.mutate({ kind: 'overwrite', preset }),
                    })
                  }
                >
                  用当前身份覆盖
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isBusy || renaming !== null}
                  onClick={() => setRenaming({ id: preset.id, name: preset.name })}
                >
                  重命名
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isBusy}
                  onClick={() =>
                    confirmAction({
                      label: '删除方案？',
                      body: `删除「${preset.name}」后无法恢复，当前房间的身份不受影响。`,
                      tone: 'danger',
                      confirmText: '删除',
                      onConfirm: () => mutation.mutate({ kind: 'delete', preset }),
                    })
                  }
                >
                  删除
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
