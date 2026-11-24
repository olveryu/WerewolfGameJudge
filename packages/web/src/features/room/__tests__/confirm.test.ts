import { act } from '@testing-library/react';

import { confirmAction, confirmView } from '@/features/room/confirm';
import { alertStore, dismissAlert } from '@/utils/alert';

function clearAlert(): void {
  const alert = alertStore.getSnapshot();
  if (alert !== null) dismissAlert(alert.generation);
}

async function pressButton(index: number): Promise<void> {
  const button = alertStore.getSnapshot()?.buttons[index];
  if (button === undefined) throw new Error(`Missing alert button ${index}`);
  await act(async () => button.onPress?.());
}

beforeEach(clearAlert);
afterEach(clearAlert);

describe('shared room confirmation entry points', () => {
  it('derives the confirmation title and gives dangerous actions their action label', () => {
    const onConfirm = vi.fn();

    confirmAction({
      label: '放逐3号',
      body: '该行动无法撤销',
      tone: 'danger',
      onConfirm,
    });

    expect(alertStore.getSnapshot()).toMatchObject({
      title: '放逐3号？',
      message: '该行动无法撤销',
      buttons: [
        { text: '取消', style: 'cancel' },
        { text: '放逐3号', style: 'destructive' },
      ],
    });
  });

  it('asks before viewing and runs the callback only after acknowledgement', async () => {
    const onView = vi.fn();

    confirmView({ label: '查看结果', onView });

    expect(alertStore.getSnapshot()).toMatchObject({
      title: '查看结果？',
      buttons: [{ text: '取消' }, { text: '查看' }],
    });
    await pressButton(0);
    expect(onView).not.toHaveBeenCalled();

    confirmView({ label: '查看结果', onView });
    await pressButton(1);
    expect(onView).toHaveBeenCalledOnce();
  });

  it('shows the viewing consequence and reports cancellation', async () => {
    const onCancel = vi.fn();
    const onView = vi.fn();

    confirmView({ label: '查看昨夜信息', body: '昨夜信息可能影响警长竞选。', onCancel, onView });

    expect(alertStore.getSnapshot()).toMatchObject({
      title: '查看昨夜信息？',
      message: '昨夜信息可能影响警长竞选。',
    });
    await pressButton(0);
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onView).not.toHaveBeenCalled();
  });

  it('does not append a second question mark to an already phrased title', () => {
    confirmAction({ label: '确认袭击1号？', onConfirm: vi.fn() });

    expect(alertStore.getSnapshot()?.title).toBe('确认袭击1号？');
  });
});
