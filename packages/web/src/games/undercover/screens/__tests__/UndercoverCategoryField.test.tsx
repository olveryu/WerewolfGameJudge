import {
  DEFAULT_UNDERCOVER_CONFIG,
  UNDERCOVER_CONFIG_SCHEMA,
} from '@game-judge/game-engine/games/undercover/public';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UndercoverCategoryField, useUndercoverConfigSubmitGate } from '../UndercoverCategoryField';

vi.mock('../../services/undercoverInventory', () => ({
  undercoverInventoryOptions: {
    queryKey: ['undercover-test'],
    queryFn: async () => ({ availableCategories: [], hasAnyWords: true }),
  },
}));

function Settings() {
  const gate = useUndercoverConfigSubmitGate(DEFAULT_UNDERCOVER_CONFIG);
  return (
    <>
      <UndercoverCategoryField
        spec={UNDERCOVER_CONFIG_SCHEMA.fields.category}
        value="all"
        onChange={() => {}}
        issueMessage={null}
        testId="category"
      />
      <span>{gate.isReady ? '允许保存' : '不能保存'}</span>
    </>
  );
}

describe('Undercover category availability', () => {
  it('allows all when inventory exists but no category reaches the threshold', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Settings />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('允许保存')).toBeDefined();
    expect(screen.getByRole('radio', { name: '全部分类' })).toBeDefined();
    expect(screen.queryByRole('radio', { name: '吃喝美食' })).toBeNull();
  });
});
