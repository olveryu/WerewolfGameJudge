/** Product-owned audio value shared by game registries and the platform player. */

/** An audio file URL (as emitted by the bundler) plus the stable cache/playback key its owning feature supplies. */
export interface AudioClip {
  readonly key: string;
  readonly url: string;
}
