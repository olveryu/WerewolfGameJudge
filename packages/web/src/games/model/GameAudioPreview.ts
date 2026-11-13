/** Game-owned audio preview offered on the music settings page. */
import type { AudioService } from '@/services/infra/AudioService';

export interface GameAudioPreview {
  /** Human-readable game name used to distinguish this preview from other games. */
  readonly gameLabel: string;
  readonly label: string;
  readonly play: () => Promise<void>;
  readonly stop: () => void;
}

/** A game's lazily loaded preview entry, bound to the page's audio service. */
export type GameAudioPreviewFactory = (audioService: AudioService) => GameAudioPreview;
