/** Product-owned audio asset values shared by game registries and playback adapters. */

/** Metro returns an asset ID on native and a URL on Web; expo-audio also accepts a URI source. */
export type AudioAsset = number | string | { readonly uri: string };

/** Immutable asset plus the stable cache/playback key supplied by an owning feature. */
export interface AudioClip {
  readonly key: string;
  readonly asset: AudioAsset;
}
