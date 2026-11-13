import type {
  ConfigValidationIssue,
  GameConfigSchema,
} from '@game-judge/game-engine/platform/config/configSchema';
import { render, screen } from '@testing-library/react';

import { GameConfigForm } from '../GameConfigForm';

interface TestConfig {
  readonly mode: 'classic' | 'quick';
  readonly playerCount: number;
  readonly hintsEnabled: boolean;
  readonly retryLimit: number;
}

const schema: GameConfigSchema<TestConfig> = {
  fields: {
    mode: {
      kind: 'choice',
      label: '模式',
      options: [
        { value: 'classic', label: '经典' },
        { value: 'quick', label: '快速' },
      ],
    },
    playerCount: { kind: 'count', label: '玩家人数', min: 2, max: 10 },
    hintsEnabled: { kind: 'toggle', label: '启用提示' },
    retryLimit: { kind: 'count', label: '重试上限', min: 3, max: 5, unit: '次' },
  },
  defaults: { mode: 'classic', playerCount: 6, hintsEnabled: false, retryLimit: 5 },
  validate: () => null,
};

function renderForm(issue: ConfigValidationIssue<TestConfig> | null) {
  render(
    <GameConfigForm
      gameType="werewolf"
      schema={schema}
      config={schema.defaults}
      countDrafts={{}}
      issue={issue}
      fieldRenderers={undefined}
      onFieldChange={() => {}}
      onCountDraftChange={() => {}}
      onStepCount={() => {}}
    />,
  );
}

describe('GameConfigForm field errors', () => {
  it('distinguishes player counts from other count settings', () => {
    renderForm(null);

    expect(screen.getByRole('button', { name: '减少人数' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '减少重试上限' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '增加重试上限' })).toBeDisabled();
    expect(screen.getByText(/^支持 2 至 10 人/)).toBeInTheDocument();
    expect(screen.getByText(/^支持 3 至 5 次/)).toBeInTheDocument();
    expect(screen.queryByText(/^支持 3 至 5 人/)).not.toBeInTheDocument();
  });

  it.each([
    {
      field: 'mode',
      query: () => screen.getByRole('radiogroup', { name: '模式' }),
    },
    {
      field: 'playerCount',
      query: () => screen.getByRole('textbox', { name: '玩家人数' }),
    },
    {
      field: 'hintsEnabled',
      query: () => screen.getByRole('switch', { name: '启用提示' }),
    },
  ] as const)('associates the $field issue with its control', ({ field, query }) => {
    const issueId = `werewolf-config-issue-${field}`;
    renderForm({ field, message: '设置无效' });

    expect(query()).toHaveAttribute('aria-invalid', 'true');
    expect(query()).toHaveAttribute('aria-describedby', issueId);
    expect(screen.getByTestId(issueId)).toHaveAttribute('id', issueId);
  });
});
