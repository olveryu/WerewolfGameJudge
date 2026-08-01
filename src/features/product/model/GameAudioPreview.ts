/** Product audio-preview data supplied by a concrete game module. */

export interface GameAudioPreviewContribution {
  readonly label: string;
  readonly play: () => Promise<void>;
  readonly stop: () => void;
}
