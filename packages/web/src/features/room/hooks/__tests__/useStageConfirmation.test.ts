import { act, renderHook } from '@testing-library/react';

import { alertStore, dismissAlert, showAlert } from '@/utils/alert';

import { useStageConfirmation } from '../useStageConfirmation';

describe('useStageConfirmation', () => {
  afterEach(() => {
    const alert = alertStore.getSnapshot();
    if (alert !== null) dismissAlert(alert.generation);
  });

  it('dismisses the pending action when the stage changes', () => {
    const onConfirm = vi.fn();
    const { result, rerender } = renderHook(({ stage }) => useStageConfirmation(stage), {
      initialProps: { stage: 'select' },
    });
    act(() => result.current('确认？', '选择', onConfirm));
    expect(alertStore.getSnapshot()?.title).toBe('确认？');
    rerender({ stage: 'drawing' });
    expect(alertStore.getSnapshot()).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not dismiss a newer unrelated alert on unmount', () => {
    const { result, unmount } = renderHook(() => useStageConfirmation('select'));
    act(() => result.current('确认？', '选择', vi.fn()));
    act(() => showAlert('新消息'));
    unmount();
    expect(alertStore.getSnapshot()?.title).toBe('新消息');
  });
});
