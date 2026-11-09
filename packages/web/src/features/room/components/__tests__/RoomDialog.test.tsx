/** RoomDialog: a dialog opened from a confirmation alert's action outlives that alert. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';

import { AlertHost } from '@/components/AlertHost';
import { showConfirmAlert } from '@/utils/alertPresets';

import { RoomDialog } from '../RoomDialog';

function ConfirmedDialog() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => showConfirmAlert('查看本局复盘？', '复盘含全员身份', () => setIsOpen(true))}
      >
        本局复盘
      </button>
      {isOpen && (
        <RoomDialog
          title="本局复盘"
          testId="room-dialog"
          onClose={() => setIsOpen(false)}
          footer={null}
        >
          详情
        </RoomDialog>
      )}
    </>
  );
}

describe('RoomDialog', () => {
  it('stays open after the confirmation alert that opened it closes', async () => {
    render(
      <>
        <ConfirmedDialog />
        <AlertHost />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: '本局复盘' }));
    await screen.findByText('查看本局复盘？');
    fireEvent.click(screen.getByRole('button', { name: '确定' }));

    await waitFor(() => expect(screen.queryByText('查看本局复盘？')).toBeNull());
    expect(screen.getByTestId('room-dialog')).toBeInTheDocument();
  });
});
