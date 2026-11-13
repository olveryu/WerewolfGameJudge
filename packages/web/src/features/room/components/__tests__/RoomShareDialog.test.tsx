import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { RoomShareDialog } from '@/features/room/components/RoomShareDialog';
import type { RoomShareModel } from '@/features/room/model/RoomShare';

const mocks = vi.hoisted(() => ({
  captureElementPngBase64: vi.fn(),
  isMiniProgram: vi.fn(),
}));

vi.mock('@/features/room/services/captureElementPng', () => ({
  captureElementPngBase64: mocks.captureElementPngBase64,
}));
vi.mock('@/utils/miniProgram', () => ({ isMiniProgram: mocks.isMiniProgram }));

function createRoomShareModel(): RoomShareModel {
  return {
    isVisible: true,
    roomCode: '1234',
    roomUrl: 'https://example.test/room/1234',
    open: vi.fn(),
    close: vi.fn(),
    copyLink: vi.fn().mockResolvedValue(undefined),
    shareImage: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isMiniProgram.mockReturnValue(false);
  mocks.captureElementPngBase64.mockResolvedValue('base64');
});

it('allows sharing to recover when the QR logo image fails to load', async () => {
  render(<RoomShareDialog model={createRoomShareModel()} />);
  const shareButton = screen.getByRole('button', { name: '分享图片' });
  const logo = screen.getByRole('dialog').querySelector('img');
  if (logo === null) throw new Error('Share card logo is missing');

  expect(shareButton).toBeDisabled();
  fireEvent.error(logo);

  await waitFor(() => expect(shareButton).toBeEnabled());
});
