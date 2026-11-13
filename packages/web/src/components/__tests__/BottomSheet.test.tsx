import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';

function BottomSheetHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open sheet
      </button>
      {isOpen && (
        <BottomSheet title="Test sheet" onClose={() => setIsOpen(false)}>
          <button type="button" onClick={() => setIsOpen(false)}>
            Close sheet
          </button>
          <button type="button">Last action</button>
        </BottomSheet>
      )}
    </>
  );
}

it('moves focus into the sheet, traps Tab, and restores focus on Escape', async () => {
  const user = userEvent.setup();
  render(<BottomSheetHarness />);
  const trigger = screen.getByRole('button', { name: 'Open sheet' });

  trigger.focus();
  fireEvent.click(trigger);

  const closeAction = screen.getByRole('button', { name: 'Close sheet' });
  const lastAction = screen.getByRole('button', { name: 'Last action' });
  expect(closeAction).toHaveFocus();

  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Tab' });
  expect(closeAction).toHaveFocus();

  lastAction.focus();
  fireEvent.keyDown(lastAction, { key: 'Tab' });
  expect(closeAction).toHaveFocus();

  closeAction.focus();
  fireEvent.keyDown(closeAction, { key: 'Tab', shiftKey: true });
  expect(lastAction).toHaveFocus();

  await user.keyboard('{Escape}');
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Test sheet' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
