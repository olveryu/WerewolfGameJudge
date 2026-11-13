/** Replay transport failures cannot hide a valid drawing or block the shared gallery. */

import {
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_WIDTH,
  type PictionaryDrawingEntry,
} from '@game-judge/game-engine/games/pictionary/public';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';

import { useRevealProgress } from '@/features/room/hooks/useRevealProgress';
import { pictionaryMediaTransport } from '@/games/pictionary/services/pictionaryMediaTransport';
import { apiClient } from '@/platform/http/client';
import { roomScreenLog } from '@/utils/logger';

import { PictionaryGalleryDrawing } from '../PictionaryGalleryDrawing';

vi.mock('@/features/room/hooks/useRevealProgress', () => ({ useRevealProgress: vi.fn() }));

const entry: PictionaryDrawingEntry = {
  kind: 'drawing',
  id: 'drawing-1',
  authorSeat: 0,
  submittedAt: 1_000,
  media: {
    objectKey: 'drawing.png',
    contentType: 'image/png',
    width: PICTIONARY_DRAWING_WIDTH,
    height: PICTIONARY_DRAWING_HEIGHT,
    byteLength: 100,
    sha256: 'png-hash',
    replay: {
      objectKey: 'drawing.strokes.json',
      byteLength: 100,
      sha256: 'a'.repeat(64),
      durationMs: 2000,
    },
  },
};

function renderDrawing(drawing: PictionaryDrawingEntry) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <PictionaryGalleryDrawing
        roomCode="1234"
        entry={drawing}
        label="画作"
        timing={{ revealStartedAt: 1_000, revealDurationMs: 2000 }}
        clock={null}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(useRevealProgress).mockReturnValue(0.5);
  vi.spyOn(pictionaryMediaTransport, 'readDrawingDataUri').mockResolvedValue(
    'data:image/png;base64,preview',
  );
  vi.spyOn(roomScreenLog, 'warn').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

it('shows the PNG with an explicit notice when stroke loading fails', async () => {
  vi.spyOn(apiClient, 'json').mockRejectedValue(new Error('replay unavailable'));
  renderDrawing(entry);
  expect(await screen.findByText('笔画回放不可用，显示成品')).toHaveAttribute('role', 'status');
  expect(await screen.findByRole('button', { name: '画作，全屏查看' })).toBeVisible();
  expect(roomScreenLog.warn).toHaveBeenCalledWith(
    'Pictionary replay unavailable; displaying PNG',
    expect.objectContaining({ entryId: entry.id }),
  );
});

it('does not request missing legacy strokes or animate completed/reduced-motion entries', async () => {
  const replayRequest = vi.spyOn(apiClient, 'json');
  const { unmount } = renderDrawing({ ...entry, media: { ...entry.media, replay: null } });
  expect(await screen.findByRole('button', { name: '画作，全屏查看' })).toBeVisible();
  expect(replayRequest).not.toHaveBeenCalled();
  unmount();
  vi.mocked(useRevealProgress).mockReturnValue(1);
  renderDrawing(entry);
  expect(await screen.findByRole('button', { name: '画作，全屏查看' })).toBeVisible();
  expect(replayRequest).not.toHaveBeenCalled();
});
