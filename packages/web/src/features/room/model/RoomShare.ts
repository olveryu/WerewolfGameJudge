/** View model for the shared room QR/share modal. */

export interface RoomShareModel {
  readonly isVisible: boolean;
  readonly roomCode: string;
  readonly roomUrl: string;
  readonly open: () => void;
  readonly close: () => void;
  readonly copyLink: () => Promise<void>;
  readonly shareImage: (getBase64: () => Promise<string>) => Promise<void>;
}
