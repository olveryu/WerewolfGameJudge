import { act, fireEvent, render } from '@testing-library/react-native';

import { MusicSettingsScreen } from '@/screens/MusicSettingsScreen/MusicSettingsScreen';

const mockGoBack = jest.fn();
const mockPreviewStop = jest.fn();
let previewResolvers: Array<() => void> = [];
const mockPreviewPlay = jest.fn(
  () =>
    new Promise<void>((resolve) => {
      previewResolvers.push(resolve);
    }),
);

const mockSettingsService = {
  load: jest.fn(async () => undefined),
  isBgmEnabled: jest.fn(() => true),
  getBgmTrack: jest.fn(() => 'random' as const),
  getBgmVolume: jest.fn(() => 0.5),
  getGameAudioVolume: jest.fn(() => 1),
  setBgmEnabled: jest.fn(async () => undefined),
  setBgmTrack: jest.fn(async () => undefined),
  setBgmVolume: jest.fn(async () => undefined),
  setGameAudioVolume: jest.fn(async () => undefined),
};

const mockAudioService = {
  stopBgm: jest.fn(),
  startBgm: jest.fn(async () => undefined),
  setBgmVolume: jest.fn(),
  setGameAudioVolume: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    canGoBack: () => true,
    goBack: mockGoBack,
  }),
}));

jest.mock('@/contexts/ServiceContext', () => ({
  useServices: () => ({
    settingsService: mockSettingsService,
    audioService: mockAudioService,
  }),
}));

jest.mock('@/games/ClientGameCatalogContext', () => ({
  useClientGameAudioPreviews: () => [
    {
      gameType: 'werewolf',
      label: '试听效果',
      play: mockPreviewPlay,
      stop: mockPreviewStop,
    },
  ],
}));

jest.mock('../components', () => ({
  NowPlayingBar: () => null,
  TrackRow: () => null,
  VolumeSlider: () => null,
}));

describe('MusicSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    previewResolvers = [];
  });

  afterEach(async () => {
    await act(async () => {
      for (const resolve of previewResolvers) resolve();
    });
  });

  it('plays and stops the game-owned audio preview contribution', async () => {
    const view = render(<MusicSettingsScreen />);

    fireEvent.press(view.getByText('试听效果'));
    expect(mockPreviewPlay).toHaveBeenCalledTimes(1);
    expect(view.getByText('停止试听')).toBeTruthy();

    fireEvent.press(view.getByText('停止试听'));
    expect(mockPreviewStop).toHaveBeenCalledTimes(1);
    expect(view.getByText('试听效果')).toBeTruthy();
  });

  it('ignores completion from a stopped invocation after the same preview restarts', async () => {
    const view = render(<MusicSettingsScreen />);

    fireEvent.press(view.getByText('试听效果'));
    fireEvent.press(view.getByText('停止试听'));
    fireEvent.press(view.getByText('试听效果'));

    await act(async () => {
      previewResolvers[0]?.();
    });

    expect(mockPreviewPlay).toHaveBeenCalledTimes(2);
    expect(view.getByText('停止试听')).toBeTruthy();
  });
});
