/**
 * 身份配置工作区：「身份」与「已保存方案」两个标签，以及固定在编辑区底部的牌数摘要。
 * 建房、准备阶段的房间设置和使用中的重开身份共用这一套编辑器；提交由调用方负责。
 */
import '../components/ToolboxTabs.css';
import './ToolboxIdentityEditor.css';

import { Tabs } from '@ark-ui/react/tabs';
import {
  countToolboxIdentityCards,
  findToolboxIdentityConfigIssue,
  normalizeToolboxName,
  TOOLBOX_IDENTITY_LIMITS,
  type ToolboxIdentityConfig,
  type ToolboxIdentityDefinition,
} from '@game-judge/game-engine/games/toolbox/public';
import { useId, useState } from 'react';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import IonCreateOutline from '~icons/ion/create-outline';
import IonTrashOutline from '~icons/ion/trash-outline';

import { ToolboxStepper } from '../components/ToolboxStepper';
import { ToolboxPresetPanel } from './ToolboxPresetPanel';

export interface ToolboxIdentityEditorProps {
  readonly value: ToolboxIdentityConfig;
  readonly onChange: (next: ToolboxIdentityConfig) => void;
  readonly isAnonymous: boolean;
  readonly isDisabled: boolean;
}

type IdentityEditing = { readonly kind: 'new' } | { readonly kind: 'edit'; readonly index: number };

interface IdentityFieldErrors {
  readonly name: string | null;
  readonly description: string | null;
  readonly count: string | null;
}

const NO_FIELD_ERRORS: IdentityFieldErrors = { name: null, description: null, count: null };

/** 身份数量的输入只接受十进制正整数；其余一律视为无效，由引擎规则给出提示。 */
function parseCountInput(raw: string): number {
  return /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN;
}

/** 把引擎对候选配置的判定映射到当前表单字段；与其他条目无关的问题不会出现在这里。 */
function findFieldErrors(
  candidate: ToolboxIdentityConfig,
  targetIndex: number,
): IdentityFieldErrors | null {
  const issue = findToolboxIdentityConfigIssue(candidate);
  if (issue === null) return null;
  switch (issue.kind) {
    case 'nameInvalid':
      return issue.index === targetIndex
        ? {
            ...NO_FIELD_ERRORS,
            name: `请填写 1–${TOOLBOX_IDENTITY_LIMITS.nameMaxLength} 个字的身份名称`,
          }
        : null;
    case 'nameDuplicate':
      return issue.index === targetIndex
        ? { ...NO_FIELD_ERRORS, name: '已有同名身份，相同身份请调整数量' }
        : null;
    case 'descriptionInvalid':
      return issue.index === targetIndex
        ? {
            ...NO_FIELD_ERRORS,
            description: `说明最多 ${TOOLBOX_IDENTITY_LIMITS.descriptionMaxLength} 个字`,
          }
        : null;
    case 'countInvalid':
      return issue.index === targetIndex
        ? {
            ...NO_FIELD_ERRORS,
            count: `数量需为 1–${TOOLBOX_IDENTITY_LIMITS.maxCountPerIdentity} 的整数`,
          }
        : null;
    case 'noIdentities':
    case 'tooManyIdentities':
    case 'cardsPerPlayerInvalid':
      return null;
  }
}

function IdentityForm({
  initial,
  title,
  onSubmit,
  onCancel,
}: {
  readonly initial: ToolboxIdentityDefinition | null;
  readonly title: string;
  /** 返回字段错误时表单保持打开；返回 null 表示已接受。 */
  readonly onSubmit: (identity: ToolboxIdentityDefinition) => IdentityFieldErrors | null;
  readonly onCancel: () => void;
}) {
  const formId = useId();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [count, setCount] = useState(String(initial?.count ?? 1));
  const [errors, setErrors] = useState<IdentityFieldErrors>(NO_FIELD_ERRORS);
  const field = (key: keyof IdentityFieldErrors) => ({
    id: `${formId}-${key}`,
    'aria-invalid': errors[key] !== null,
    'aria-describedby': errors[key] === null ? undefined : `${formId}-${key}-error`,
  });
  const fieldError = (key: keyof IdentityFieldErrors) =>
    errors[key] === null ? null : (
      <p id={`${formId}-${key}-error`} className="toolbox-identity-field-error">
        {errors[key]}
      </p>
    );
  return (
    <form
      className="toolbox-identity-form"
      aria-label={title}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const nextErrors = onSubmit({
          name: normalizeToolboxName(name),
          description: description.trim(),
          count: parseCountInput(count),
        });
        if (nextErrors !== null) setErrors(nextErrors);
      }}
    >
      <h3>{title}</h3>
      <label htmlFor={`${formId}-name`}>身份名称</label>
      <input
        {...field('name')}
        value={name}
        autoComplete="off"
        onChange={(event) => setName(event.currentTarget.value)}
      />
      {fieldError('name')}
      <label htmlFor={`${formId}-description`}>说明（可选）</label>
      <textarea
        {...field('description')}
        value={description}
        rows={2}
        onChange={(event) => setDescription(event.currentTarget.value)}
      />
      {fieldError('description')}
      <label htmlFor={`${formId}-count`}>数量</label>
      <input
        {...field('count')}
        value={count}
        inputMode="numeric"
        onChange={(event) => setCount(event.currentTarget.value)}
      />
      {fieldError('count')}
      <div className="toolbox-identity-form-actions">
        <Button type="submit">保存身份</Button>
        <Button variant="secondary" onClick={onCancel}>
          取消
        </Button>
      </div>
    </form>
  );
}

function IdentityList({
  value,
  onChange,
  isDisabled,
}: Omit<ToolboxIdentityEditorProps, 'isAnonymous'>) {
  const [editing, setEditing] = useState<IdentityEditing | null>(null);
  const isFull = value.identities.length >= TOOLBOX_IDENTITY_LIMITS.maxIdentityTypes;
  const commit = (identity: ToolboxIdentityDefinition, target: IdentityEditing) => {
    const identities =
      target.kind === 'new'
        ? [...value.identities, identity]
        : value.identities.map((current, index) => (index === target.index ? identity : current));
    const candidate = { ...value, identities };
    const targetIndex = target.kind === 'new' ? identities.length - 1 : target.index;
    const errors = findFieldErrors(candidate, targetIndex);
    if (errors !== null) return errors;
    onChange(candidate);
    setEditing(null);
    return null;
  };
  return (
    <div className="toolbox-identity-list">
      {editing?.kind === 'new' ? (
        <IdentityForm
          initial={null}
          title="添加身份"
          onSubmit={(identity) => commit(identity, editing)}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <Button
          variant="outline"
          disabled={isDisabled || isFull || editing !== null}
          onClick={() => setEditing({ kind: 'new' })}
        >
          {isFull ? `最多 ${TOOLBOX_IDENTITY_LIMITS.maxIdentityTypes} 种身份` : '添加身份'}
        </Button>
      )}
      {value.identities.length === 0 && editing === null && (
        <p className="toolbox-identity-empty-state">还没有身份，添加身份后才能开始</p>
      )}
      <ul>
        {value.identities.map((identity, index) =>
          editing?.kind === 'edit' && editing.index === index ? (
            <li key={`editing-${identity.name}`}>
              <IdentityForm
                initial={identity}
                title={`编辑「${identity.name}」`}
                onSubmit={(next) => commit(next, editing)}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={identity.name} className="toolbox-identity-item">
              <div>
                <strong>{identity.name}</strong>
                <span className="toolbox-identity-item-count">× {identity.count}</span>
                {identity.description.length > 0 && <p>{identity.description}</p>}
              </div>
              <IconButton
                label={`编辑身份「${identity.name}」`}
                icon={<IonCreateOutline aria-hidden="true" />}
                disabled={isDisabled || editing !== null}
                onClick={() => setEditing({ kind: 'edit', index })}
              />
              <IconButton
                label={`删除身份「${identity.name}」`}
                icon={<IonTrashOutline aria-hidden="true" />}
                disabled={isDisabled || editing !== null}
                onClick={() =>
                  onChange({
                    ...value,
                    identities: value.identities.filter((_, current) => current !== index),
                  })
                }
              />
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

/** 「身份」「已保存方案」两个标签；草稿只在当前房间生效。 */
export function ToolboxIdentityEditor(props: ToolboxIdentityEditorProps) {
  const [tab, setTab] = useState('identities');
  return (
    <Tabs.Root
      className="toolbox-identity-editor"
      value={tab}
      onValueChange={(details) => setTab(details.value)}
    >
      <Tabs.List className="toolbox-tabs" aria-label="身份配置">
        <Tabs.Trigger value="identities" className="toolbox-tab">
          身份（{props.value.identities.length}）
        </Tabs.Trigger>
        <Tabs.Trigger value="presets" className="toolbox-tab">
          已保存方案
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="identities">
        <IdentityList value={props.value} onChange={props.onChange} isDisabled={props.isDisabled} />
      </Tabs.Content>
      <Tabs.Content value="presets">
        {props.isAnonymous ? (
          <p className="toolbox-identity-empty-state">登录后可保存和使用方案</p>
        ) : (
          <ToolboxPresetPanel
            draft={props.value}
            isDisabled={props.isDisabled}
            onLoad={(identity) => {
              props.onChange(identity);
              setTab('identities');
            }}
          />
        )}
      </Tabs.Content>
    </Tabs.Root>
  );
}

export interface ToolboxIdentitySummaryProps {
  readonly value: ToolboxIdentityConfig;
  readonly onCardsPerPlayerChange: (cardsPerPlayer: number) => void;
  /** 开始前按已入座人数，使用中按本轮锁定人数；建房时尚无人入座为 null。 */
  readonly requirement: { readonly playerCount: number; readonly label: string } | null;
  readonly isDisabled: boolean;
}

/** 固定在编辑区底部的牌数摘要：每人抽牌数、总张数、需要张数与缺口。 */
export function ToolboxIdentitySummary({
  value,
  onCardsPerPlayerChange,
  requirement,
  isDisabled,
}: ToolboxIdentitySummaryProps) {
  const total = countToolboxIdentityCards(value);
  const required = requirement === null ? null : value.cardsPerPlayer * requirement.playerCount;
  const shortage = required === null ? 0 : required - total;
  return (
    <div className="toolbox-identity-summary">
      <div className="toolbox-identity-summary-row">
        <strong>每人抽 {value.cardsPerPlayer} 张</strong>
        <ToolboxStepper
          label="每人抽牌数量"
          value={value.cardsPerPlayer}
          unit="张"
          min={1}
          max={TOOLBOX_IDENTITY_LIMITS.maxCardsPerPlayer}
          isDisabled={isDisabled}
          onChange={onCardsPerPlayerChange}
        />
      </div>
      <p className="toolbox-identity-summary-counts" aria-live="polite">
        <span>共 {total} 张</span>
        <span>
          {requirement === null || required === null
            ? '开始时按入座人数核对'
            : `需要 ${required} 张（${requirement.label}）`}
        </span>
      </p>
      {shortage > 0 && (
        <p className="toolbox-identity-summary-shortage" role="status">
          还差 {shortage} 张，请增加身份牌数量
        </p>
      )}
    </div>
  );
}
