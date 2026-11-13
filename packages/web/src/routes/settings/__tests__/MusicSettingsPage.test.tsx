/** Music settings page: persistence failures and game-owned audio preview playback. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { Mock } from 'vitest';

import { useServices } from '@/contexts/ServiceContext';
import { BGM_TRACKS } from '@/features/product/model/BgmCatalog';
import { audioSettings } from '@/features/settings/audioSettings';
import { type ClientGameAudioPreview, loadClientGameAudioPreviews } from '@/games/catalog';
import { MusicSettingsPage } from '@/routes/settings/MusicSettingsPage';
import { createFakeBgm } from '@/test-utils/fakeBgm';
import { handleError } from '@/utils/errorPipeline';

vi.mock('@/contexts/ServiceContext', () => ({ useServices: vi.fn() }));
vi.mock('@/utils/errorPipeline', () => ({ handleError: vi.fn() }));
vi.mock('@/games/catalog', () => ({ loadClientGameAudioPreviews: vi.fn() }));

const audioService = {
  ...createFakeBgm(),
  setBgmVolume: vi.fn(),
  setGameAudioVolume: vi.fn(),
};
const previewStop = vi.fn();
let previewResolvers: Array<() => void> = [];
const previewPlay = vi.fn(
  () =>
    new Promise<void>((resolve) => {
      previewResolvers.push(resolve);
    }),
);
const werewolfPreview: ClientGameAudioPreview = {
  gameType: 'werewolf',
  gameLabel: '狼人杀',
  label: '试听效果',
  play: previewPlay,
  stop: previewStop,
};
const avalonPreview: ClientGameAudioPreview = {
  gameType: 'avalon',
  gameLabel: '阿瓦隆',
  label: '试听效果',
  play: previewPlay,
  stop: previewStop,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/', Component: MusicSettingsPage }]);
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('MusicSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    audioService.stopOnItsOwn();
    previewResolvers = [];
    (useServices as Mock).mockReturnValue({ loadAudioService: async () => audioService });
    (loadClientGameAudioPreviews as Mock).mockResolvedValue([werewolfPreview]);
  });

  afterEach(async () => {
    await act(async () => {
      for (const resolve of previewResolvers) resolve();
    });
  });

  it('keeps the saved switch value and reports a persistence failure', async () => {
    const error = new Error('Storage disabled');
    vi.spyOn(audioSettings, 'setBgmEnabled').mockImplementationOnce(() => {
      throw error;
    });
    renderPage();

    const bgmSwitch = await screen.findByRole('switch', { name: '背景音乐' });
    expect(bgmSwitch).toBeChecked();
    await userEvent.click(bgmSwitch);

    expect(bgmSwitch).toBeChecked();
    expect(handleError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ label: '保存音乐设置' }),
    );
  });

  it('shows a track preview as stopped once the player stops on its own', async () => {
    renderPage();
    const firstTrack = BGM_TRACKS[0];
    if (firstTrack === undefined) throw new Error('BGM catalog is empty');

    await userEvent.click(await screen.findByRole('button', { name: `试听 ${firstTrack.label}` }));
    expect(audioService.startBgm).toHaveBeenCalledWith([firstTrack.url]);
    expect(
      screen.getByRole('button', { name: `停止试听 ${firstTrack.label}` }),
    ).toBeInTheDocument();

    act(() => audioService.stopOnItsOwn());
    expect(screen.getByRole('button', { name: `试听 ${firstTrack.label}` })).toBeInTheDocument();
  });

  it('plays and stops the game-owned audio preview contribution', async () => {
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: '试听效果（狼人杀）' }));
    expect(previewPlay).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '停止试听效果（狼人杀）' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '停止试听效果（狼人杀）' }));
    expect(previewStop).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '试听效果（狼人杀）' })).toBeInTheDocument();
  });

  it('distinguishes preview actions by game', async () => {
    (loadClientGameAudioPreviews as Mock).mockResolvedValue([werewolfPreview, avalonPreview]);
    renderPage();

    expect(await screen.findByRole('button', { name: '试听效果（狼人杀）' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '试听效果（阿瓦隆）' })).toBeInTheDocument();
  });

  it('ignores completion from a stopped invocation after the same preview restarts', async () => {
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: '试听效果（狼人杀）' }));
    await userEvent.click(screen.getByRole('button', { name: '停止试听效果（狼人杀）' }));
    await userEvent.click(screen.getByRole('button', { name: '试听效果（狼人杀）' }));

    await act(async () => {
      previewResolvers[0]?.();
    });

    expect(previewPlay).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: '停止试听效果（狼人杀）' })).toBeInTheDocument();
  });
});
