import type { GameAudioPreviewContribution } from '@/features/product/model/GameAudioPreview';
import { getClientGameAudioPreviews } from '@/games/audioPreviews';

describe('getClientGameAudioPreviews', () => {
  it('projects only game modules that own a preview', async () => {
    const play = jest.fn(async () => undefined);
    const stop = jest.fn();
    const preview: GameAudioPreviewContribution = { label: '试听效果', play, stop };
    expect(getClientGameAudioPreviews([{ gameType: 'werewolf', audioPreview: null }])).toEqual([]);
    const result = getClientGameAudioPreviews([{ gameType: 'werewolf', audioPreview: preview }]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ gameType: 'werewolf', label: '试听效果' });
    await result[0]!.play();
    result[0]!.stop();
    expect(play).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
