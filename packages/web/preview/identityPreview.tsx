import './identityPreview.css';

import { Tabs } from '@ark-ui/react/tabs';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/Button';
import { RoomDialog } from '@/features/room/components/RoomDialog';

export type IdentityRole = {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly count: string;
};

export type IdentityConfiguration = {
  readonly roles: readonly IdentityRole[];
  readonly cardsPerPlayer: string;
};

export type SavedIdentityConfiguration = {
  readonly name: string;
  readonly configuration: IdentityConfiguration;
};

export type IdentityCard = { readonly name: string; readonly description: string };

export const emptyIdentityConfiguration: IdentityConfiguration = {
  roles: [{ id: 1, name: '', description: '', count: '1' }],
  cardsPerPlayer: '1',
};

export const exampleIdentityConfiguration: IdentityConfiguration = {
  roles: [
    { id: 1, name: '侦探', description: '观察并寻找线索', count: '1' },
    { id: 2, name: '旅人', description: '', count: '3' },
  ],
  cardsPerPlayer: '1',
};

function positiveInteger(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function configurationError(
  configuration: IdentityConfiguration,
): { readonly message: string; readonly roleId?: number } | null {
  const perPlayer = positiveInteger(configuration.cardsPerPlayer);
  if (perPlayer === null) return { message: '每人抽牌数必须是正整数。' };
  const missingName = configuration.roles.find((role) => role.name.trim() === '');
  if (missingName !== undefined)
    return { message: '请填写每种身份的名称。', roleId: missingName.id };
  const names = new Set<string>();
  for (const role of configuration.roles) {
    const name = role.name.trim();
    if (names.has(name)) return { message: '身份名称不能重复。', roleId: role.id };
    names.add(name);
  }
  const invalidCount = configuration.roles.find((role) => positiveInteger(role.count) === null);
  if (invalidCount !== undefined)
    return { message: '每种身份的数量必须是正整数。', roleId: invalidCount.id };
  const counts = configuration.roles.map((role) => positiveInteger(role.count));
  const total = counts.reduce<number>((sum, count) => sum + (count ?? 0), 0);
  if (total > 200) return { message: '离线预览最多支持 200 张身份牌。' };
  return null;
}

/** Creates the preview-only shared deck from a validated configuration. */
export function createIdentityDeck(configuration: IdentityConfiguration): IdentityCard[] {
  return configuration.roles.flatMap((role) =>
    Array.from({ length: Number(role.count) }, () => ({
      name: role.name.trim(),
      description: role.description.trim(),
    })),
  );
}

export function ToolOptions({
  dice,
  identity,
  onDiceChange,
  onIdentityChange,
}: {
  readonly dice: boolean;
  readonly identity: boolean;
  readonly onDiceChange: (selected: boolean) => void;
  readonly onIdentityChange: (selected: boolean) => void;
}) {
  return (
    <fieldset className="identity-tool-options">
      <legend>本局道具</legend>
      <label className="identity-tool-option">
        <input
          type="checkbox"
          checked={dice}
          onChange={(event) => onDiceChange(event.currentTarget.checked)}
        />
        <span>
          <strong>骰子</strong>
          <small>摇骰并固定点数</small>
        </span>
      </label>
      <label className="identity-tool-option">
        <input
          type="checkbox"
          checked={identity}
          onChange={(event) => onIdentityChange(event.currentTarget.checked)}
        />
        <span>
          <strong>抽身份</strong>
          <small>配置身份牌，玩家自行抽取</small>
        </span>
      </label>
    </fieldset>
  );
}

function IdentityRoleEditor({
  role,
  index,
  removable,
  onChange,
  onRemove,
}: {
  readonly role: IdentityRole;
  readonly index: number;
  readonly removable: boolean;
  readonly onChange: (role: IdentityRole) => void;
  readonly onRemove: () => void;
}) {
  const prefix = `identity-${role.id}`;
  return (
    <fieldset className="identity-role-editor">
      <legend>身份 {index + 1}</legend>
      <label htmlFor={`${prefix}-name`}>身份名称</label>
      <input
        id={`${prefix}-name`}
        value={role.name}
        maxLength={40}
        onChange={(event) => onChange({ ...role, name: event.currentTarget.value })}
      />
      <label htmlFor={`${prefix}-description`}>身份说明（可选）</label>
      <textarea
        id={`${prefix}-description`}
        value={role.description}
        maxLength={300}
        rows={2}
        onChange={(event) => onChange({ ...role, description: event.currentTarget.value })}
      />
      <div className="identity-role-row">
        <div>
          <label htmlFor={`${prefix}-count`}>数量</label>
          <input
            id={`${prefix}-count`}
            type="number"
            min="1"
            max="200"
            value={role.count}
            onChange={(event) => onChange({ ...role, count: event.currentTarget.value })}
          />
        </div>
        {removable && (
          <Button variant="ghost" onClick={onRemove} aria-label={`删除身份 ${index + 1}`}>
            删除
          </Button>
        )}
      </div>
    </fieldset>
  );
}

function SavedConfigurations({
  saved,
  selected,
  name,
  onSelect,
  onNameChange,
  onSaveNew,
  onUpdate,
}: {
  readonly saved: readonly SavedIdentityConfiguration[];
  readonly selected: string;
  readonly name: string;
  readonly onSelect: (name: string) => void;
  readonly onNameChange: (name: string) => void;
  readonly onSaveNew: () => void;
  readonly onUpdate: () => void;
}) {
  return (
    <details className="identity-saved">
      <summary>身份方案{saved.length > 0 ? `（${saved.length} 套）` : '（可选）'}</summary>
      <p>仅保存在当前预览中，刷新或切换视角后清除；尚未接入账号保存。</p>
      {saved.length > 0 && (
        <>
          <label htmlFor="identity-saved-choice">使用已保存的方案</label>
          <select
            id="identity-saved-choice"
            value={selected}
            onChange={(event) => onSelect(event.currentTarget.value)}
          >
            <option value="">选择方案</option>
            {saved.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </>
      )}
      <label htmlFor="identity-saved-name">方案名称</label>
      <input
        id="identity-saved-name"
        value={name}
        maxLength={40}
        onChange={(event) => onNameChange(event.currentTarget.value)}
      />
      <div className="identity-inline-actions">
        <Button variant="secondary" onClick={onSaveNew}>
          保存新方案
        </Button>
        {selected !== '' && (
          <Button variant="secondary" onClick={onUpdate}>
            更新已选方案
          </Button>
        )}
      </div>
    </details>
  );
}

export function IdentitySetupDialog({
  initial,
  seatCount,
  saved,
  reset,
  onSave,
  onClose,
  onSubmit,
}: {
  readonly initial: IdentityConfiguration;
  readonly seatCount: number;
  readonly saved: readonly SavedIdentityConfiguration[];
  readonly reset: boolean;
  readonly onSave: (item: SavedIdentityConfiguration) => void;
  readonly onClose: (configuration: IdentityConfiguration) => void;
  readonly onSubmit: (configuration: IdentityConfiguration) => void;
}) {
  const [configuration, setConfiguration] = useState(initial);
  const [activeRole, setActiveRole] = useState(String(initial.roles[0]?.id ?? 1));
  const tabsRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const list = tabsRef.current;
    const tab = list?.querySelector('[role="tab"][aria-selected="true"]');
    if (list === null || tab === null || tab === undefined) return;
    const listBounds = list.getBoundingClientRect();
    const tabBounds = tab.getBoundingClientRect();
    if (tabBounds.left < listBounds.left) list.scrollLeft += tabBounds.left - listBounds.left;
    if (tabBounds.right > listBounds.right) list.scrollLeft += tabBounds.right - listBounds.right;
  }, [activeRole]);
  const total = configuration.roles.reduce(
    (sum, role) => sum + (positiveInteger(role.count) ?? 0),
    0,
  );
  const perPlayer = positiveInteger(configuration.cardsPerPlayer);
  const reportConfigurationError = (error: NonNullable<ReturnType<typeof configurationError>>) => {
    if (error.roleId !== undefined) setActiveRole(String(error.roleId));
    setMessage(error.message);
  };
  const save = (update: boolean) => {
    const error = configurationError(configuration);
    if (error !== null) return reportConfigurationError(error);
    const saveName = update ? selected : name.trim();
    if (saveName === '') return setMessage('请填写方案名称。');
    if (!update && saved.some((item) => item.name === saveName))
      return setMessage('方案名称已存在，请换一个名称。');
    onSave({ name: saveName, configuration });
    setSelected(saveName);
    setName(saveName);
    setMessage(`「${saveName}」已保存到本次预览。`);
  };
  const submit = () => {
    const error = configurationError(configuration);
    if (error !== null) return reportConfigurationError(error);
    if (perPlayer === null || total < perPlayer * seatCount)
      return setMessage(
        `身份牌不足：${seatCount} 人共需要 ${Number(configuration.cardsPerPlayer) * seatCount} 张。`,
      );
    onSubmit(configuration);
  };
  return (
    <RoomDialog
      title={reset ? '重开身份牌' : '配置抽身份'}
      subtitle={reset ? '确认后重新洗牌，其他道具不受影响' : undefined}
      dismissOnEscape
      onClose={() => onClose(configuration)}
      footer={
        <>
          <div className="identity-footer-count">
            <label htmlFor="identity-cards-per-player">每人抽牌数量</label>
            <input
              id="identity-cards-per-player"
              form="identity-setup-form"
              type="number"
              min="1"
              max="200"
              value={configuration.cardsPerPlayer}
              onChange={(event) =>
                setConfiguration({ ...configuration, cardsPerPlayer: event.currentTarget.value })
              }
            />
            <p className="identity-summary">
              共 {total} 张 · {seatCount} 人需 {perPlayer === null ? '—' : perPlayer * seatCount} 张
            </p>
          </div>
          {message !== '' && (
            <p className="identity-message" role="status">
              {message}
            </p>
          )}
          <div className="identity-footer-actions">
            <Button type="submit" form="identity-setup-form">
              {reset ? '确认重开' : '开始游戏'}
            </Button>
            <Button variant="secondary" onClick={() => onClose(configuration)}>
              取消
            </Button>
          </div>
        </>
      }
    >
      <form
        id="identity-setup-form"
        className="identity-setup"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <SavedConfigurations
          saved={saved}
          selected={selected}
          name={name}
          onNameChange={setName}
          onSelect={(next) => {
            setSelected(next);
            const item = saved.find((entry) => entry.name === next);
            if (item !== undefined) {
              setConfiguration(item.configuration);
              setActiveRole(String(item.configuration.roles[0]?.id ?? 1));
              setName(item.name);
              setMessage('');
            }
          }}
          onSaveNew={() => save(false)}
          onUpdate={() => save(true)}
        />
        <Tabs.Root value={activeRole} onValueChange={(details) => setActiveRole(details.value)}>
          <Tabs.List ref={tabsRef} className="identity-role-tabs" aria-label="身份">
            {configuration.roles.map((role, index) => (
              <Tabs.Trigger key={role.id} value={String(role.id)} className="identity-role-tab">
                {role.name.trim() || `身份 ${index + 1}`}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          {configuration.roles.map((role, index) => (
            <Tabs.Content key={role.id} value={String(role.id)}>
              <IdentityRoleEditor
                role={role}
                index={index}
                removable={configuration.roles.length > 1}
                onChange={(next) =>
                  setConfiguration({
                    ...configuration,
                    roles: configuration.roles.map((item) => (item.id === role.id ? next : item)),
                  })
                }
                onRemove={() => {
                  const remaining = configuration.roles.filter((item) => item.id !== role.id);
                  setConfiguration({ ...configuration, roles: remaining });
                  setActiveRole(String(remaining[Math.max(0, index - 1)]?.id ?? 1));
                }}
              />
            </Tabs.Content>
          ))}
        </Tabs.Root>
        <Button
          variant="outline"
          onClick={() => {
            const id = Math.max(...configuration.roles.map((role) => role.id)) + 1;
            setConfiguration({
              ...configuration,
              roles: [...configuration.roles, { id, name: '', description: '', count: '1' }],
            });
            setActiveRole(String(id));
          }}
        >
          添加身份
        </Button>
      </form>
    </RoomDialog>
  );
}

export function IdentityDrawDialog({
  remaining,
  cards,
  limit,
  onDraw,
  onClose,
}: {
  readonly remaining: number;
  readonly cards: readonly IdentityCard[];
  readonly limit: number;
  readonly onDraw: () => void;
  readonly onClose: () => void;
}) {
  return (
    <RoomDialog
      title="抽身份"
      subtitle="仅展示当前预览视角的牌"
      dismissOnEscape
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          完成
        </Button>
      }
    >
      <div className="identity-draw">
        <p>
          已抽 {cards.length} / {limit} 张 · 牌堆剩余 {remaining} 张
        </p>
        <button
          type="button"
          className="identity-deck"
          onClick={onDraw}
          disabled={cards.length >= limit || remaining === 0}
          aria-label="抽一张身份牌"
        >
          <span aria-hidden="true">✦</span>
          <strong>抽一张</strong>
        </button>
        {cards.length >= limit && <p>已抽完你的身份牌</p>}
        {cards.length > 0 && (
          <>
            <h3>我的身份</h3>
            <ol className="identity-card-list">
              {cards.map((card, index) => (
                <li key={index}>
                  <strong>{card.name}</strong>
                  {card.description !== '' && <p>{card.description}</p>}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </RoomDialog>
  );
}
