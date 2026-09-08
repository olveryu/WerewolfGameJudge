/** Pictionary editable text draft persistence contracts. */

import type { PictionaryTaskDraftScope } from '../pictionaryTaskDraftScope';
import { pictionaryTextDraftStore } from '../PictionaryTextDraftStore';

const mockStoredValues = new Map<string, string>();

jest.mock('@/services/infra/localStorage', () => ({
  storage: {
    getString: (key: string): string | undefined => mockStoredValues.get(key),
    set: (key: string, value: string): void => {
      mockStoredValues.set(key, value);
    },
    remove: (key: string): void => {
      mockStoredValues.delete(key);
    },
  },
}));

const SCOPE: PictionaryTaskDraftScope = {
  roomCode: '2468',
  roundId: 'round-1',
  taskId: 'chain-1:2',
  userId: 'host',
};

describe('PictionaryTextDraftStore', () => {
  beforeEach(() => mockStoredValues.clear());

  it('round-trips editable text before final validation', () => {
    pictionaryTextDraftStore.write(SCOPE, ' 尚未完成 ');

    expect(pictionaryTextDraftStore.read(SCOPE)).toBe(' 尚未完成 ');
  });

  it('keeps independent drafts for multiple tasks controlled by one user', () => {
    const secondScope = { ...SCOPE, taskId: 'chain-2:2' };

    pictionaryTextDraftStore.write(SCOPE, '第一份');
    pictionaryTextDraftStore.write(secondScope, '第二份');

    expect(pictionaryTextDraftStore.read(SCOPE)).toBe('第一份');
    expect(pictionaryTextDraftStore.read(secondScope)).toBe('第二份');
  });

  it('removes storage when editing returns to an empty draft', () => {
    pictionaryTextDraftStore.write(SCOPE, '临时内容');
    pictionaryTextDraftStore.write(SCOPE, '');

    expect(pictionaryTextDraftStore.read(SCOPE)).toBeNull();
  });
});
