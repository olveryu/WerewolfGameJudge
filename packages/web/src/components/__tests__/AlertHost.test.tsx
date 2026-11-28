/** AlertHost: a replacement alert reuses the open dialog's interactive layer. */
import { act, fireEvent, render, screen } from '@testing-library/react';

import { TESTIDS } from '@/testids';
import { alertStore, dismissAlert, showAlert } from '@/utils/alert';
import { showConfirmAlert } from '@/utils/alertPresets';

import { AlertHost } from '../AlertHost';

describe('AlertHost', () => {
  it('exposes the active alert generation for scoped dismissal', () => {
    let shownGeneration: number | null = null;
    act(() =>
      showConfirmAlert('确认操作', '继续吗？', vi.fn(), {
        onShown: (generation) => {
          shownGeneration = generation;
        },
      }),
    );

    expect(shownGeneration).toBe(alertStore.getSnapshot()?.generation);
    const generation = shownGeneration;
    if (generation === null) throw new Error('Expected an active confirmation');
    act(() => dismissAlert(generation));
    expect(alertStore.getSnapshot()).toBeNull();
  });

  it('keeps the dialog content node when a newer alert replaces an open one', async () => {
    render(<AlertHost />);
    act(() => showAlert('确认查验', '查验 1号？', [{ text: '确定' }]));
    const firstContent = await screen.findByTestId(TESTIDS.alertModal);
    const firstTitle = screen.getByTestId(TESTIDS.alertTitle);

    const onAcknowledge = vi.fn();
    act(() =>
      showAlert('查验结果：1号是好人', '好人', [{ text: '知道了', onPress: onAcknowledge }]),
    );

    // The open dialog registered this node as its pointer-interactive layer; a remounted node
    // would sit under the inert body and swallow no clicks.
    expect(screen.getByTestId(TESTIDS.alertModal)).toBe(firstContent);
    // The body is per alert: the replaced alert's nodes detach, so a captured title or button
    // can never act on the newer alert (the e2e alert driver relies on this).
    expect(firstTitle.isConnected).toBe(false);
    expect(screen.getByTestId(TESTIDS.alertTitle)).toHaveTextContent('查验结果：1号是好人');
    fireEvent.click(screen.getByRole('button', { name: '知道了' }));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });
});
