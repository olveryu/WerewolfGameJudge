/**
 * useScopedDraft: a draft survives only for the exact scope that wrote
 * it; a changed scope or an undecodable slot is cleared, never carried
 * over; an empty draft removes the slot.
 */
import { act, renderHook } from '@testing-library/react-native';

import { type ScopedDraftStorage, useScopedDraft } from '../useScopedDraft';

interface Draft {
  readonly seats: readonly number[];
}

const INITIAL: Draft = { seats: [] };
function parse(value: unknown): Draft {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('seats' in value) ||
    !Array.isArray(value.seats) ||
    value.seats.some((seat) => typeof seat !== 'number')
  ) {
    throw new Error('bad draft');
  }
  return { seats: value.seats.map((seat: number) => seat) };
}

function memoryStorage(): ScopedDraftStorage & { readonly map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getString: (key) => map.get(key),
    set: (key, value) => void map.set(key, value),
    remove: (key) => void map.delete(key),
  };
}

const KEY = '@room:draft:test:u1:room-1';

function renderDraft(draftStorage: ScopedDraftStorage, scope: Record<string, string | number>) {
  return renderHook(
    (props: { scope: Record<string, string | number> }) =>
      useScopedDraft<Draft>({
        namespace: 'test',
        userId: 'u1',
        roomId: 'room-1',
        scope: props.scope,
        initial: INITIAL,
        parse,
        draftStorage,
      }),
    { initialProps: { scope } },
  );
}

describe('useScopedDraft', () => {
  it('persists edits under the scope and reads them back on remount', () => {
    const draftStorage = memoryStorage();
    const first = renderDraft(draftStorage, { step: 'wolfKill', actor: 2 });
    act(() => first.result.current.updateDraft((current) => ({ seats: [...current.seats, 4] })));
    expect(first.result.current.draft).toEqual({ seats: [4] });
    expect(JSON.parse(draftStorage.map.get(KEY) ?? 'null')).toMatchObject({
      value: { seats: [4] },
    });
    first.unmount();

    const second = renderDraft(draftStorage, { step: 'wolfKill', actor: 2 });
    expect(second.result.current.draft).toEqual({ seats: [4] });
  });

  it('clears the slot when any scope field changes', () => {
    const draftStorage = memoryStorage();
    const { result, rerender } = renderDraft(draftStorage, { step: 'wolfKill', actor: 2 });
    act(() => result.current.setDraft({ seats: [1, 2] }));
    rerender({ scope: { step: 'witchAction', actor: 2 } });
    expect(result.current.draft).toEqual(INITIAL);
    expect(draftStorage.map.has(KEY)).toBe(false);
  });

  it('clears an undecodable slot instead of falling back to a partial value', () => {
    const draftStorage = memoryStorage();
    draftStorage.set(
      KEY,
      JSON.stringify({
        version: 1,
        scopeKey: '{"actor":2,"step":"wolfKill"}',
        value: { seats: ['x'] },
      }),
    );
    const { result } = renderDraft(draftStorage, { step: 'wolfKill', actor: 2 });
    expect(result.current.draft).toEqual(INITIAL);
    expect(draftStorage.map.has(KEY)).toBe(false);
  });

  it('removes the slot when the draft returns to its initial value', () => {
    const draftStorage = memoryStorage();
    const { result } = renderDraft(draftStorage, { step: 'wolfKill', actor: 2 });
    act(() => result.current.setDraft({ seats: [3] }));
    expect(draftStorage.map.has(KEY)).toBe(true);
    act(() => result.current.clear());
    expect(result.current.draft).toEqual(INITIAL);
    expect(draftStorage.map.has(KEY)).toBe(false);
  });
});
