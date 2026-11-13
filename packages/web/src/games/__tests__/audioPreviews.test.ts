import { loadClientGameAudioPreviews } from '@/games/catalog';
import { AudioService } from '@/services/infra/AudioService';

describe('loadClientGameAudioPreviews', () => {
  it('loads only the narrated games, bound to the given audio service', async () => {
    const audioService = new AudioService();
    const playClip = vi.spyOn(audioService, 'playClip').mockResolvedValue(undefined);
    const stop = vi.spyOn(audioService, 'stop').mockImplementation(() => undefined);

    const previews = await loadClientGameAudioPreviews(audioService);

    expect(
      previews.map(({ gameType, gameLabel, label }) => ({ gameType, gameLabel, label })),
    ).toEqual([
      { gameType: 'werewolf', gameLabel: '狼人杀', label: '试听效果' },
      { gameType: 'avalon', gameLabel: '阿瓦隆', label: '试听效果' },
    ]);
    const [werewolf, avalon] = previews;
    await werewolf!.play();
    await avalon!.play();
    werewolf!.stop();
    expect(playClip).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ key: 'role_begin_wolf' }),
    );
    expect(playClip).toHaveBeenNthCalledWith(2, expect.objectContaining({ key: 'night' }));
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
