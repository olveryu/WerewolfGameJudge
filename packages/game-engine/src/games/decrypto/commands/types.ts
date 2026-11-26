/** Public and system Decrypto commands; actor identity comes from the platform. */

import type {
  RoomProfileUpdateCommand,
  RoomSeatCommand,
} from '../../../platform/protocol/commands';
import type { RoomProfileUpdate, RoomSeatProfile } from '../../../platform/room/roster';
import type { DecryptoConfig, DecryptoKeywords, DecryptoTeam } from '../state/types';

export type DecryptoPublicCommand =
  | RoomSeatCommand<RoomSeatProfile>
  | RoomProfileUpdateCommand<RoomProfileUpdate>
  | { readonly type: 'decrypto.config.update'; readonly config: DecryptoConfig }
  | { readonly type: 'decrypto.game.begin' }
  | { readonly type: 'decrypto.teams.move'; readonly seat: number }
  | {
      readonly type: 'decrypto.teams.encryptor';
      readonly team: DecryptoTeam;
      readonly seat: number;
    }
  | { readonly type: 'decrypto.teams.randomize' }
  | { readonly type: 'decrypto.teams.confirm' }
  | { readonly type: 'decrypto.clues.submit'; readonly clues: readonly [string, string, string] }
  | {
      readonly type: 'decrypto.guess.submit';
      readonly kind: 'decode' | 'intercept';
      readonly guess: readonly [number, number, number];
    }
  | { readonly type: 'decrypto.reveal.continue'; readonly gameSequence: number }
  | {
      readonly type: 'decrypto.tiebreak.submit';
      readonly guesses: DecryptoKeywords;
    }
  | {
      readonly type: 'decrypto.tiebreak.judge';
      readonly team: DecryptoTeam;
      readonly correct: readonly [boolean, boolean, boolean, boolean];
    }
  | {
      readonly type: 'decrypto.game.restart';
      readonly gameSequence: number;
      readonly wasEnded: boolean;
    };

export type DecryptoInternalCommand =
  | {
      readonly type: 'decrypto.words.selected';
      readonly requestId: string;
      readonly keywords: Readonly<Record<DecryptoTeam, DecryptoKeywords>>;
    }
  | {
      readonly type: 'decrypto.reveal.advance';
      readonly gameSequence: number;
      readonly round: number;
      readonly team: DecryptoTeam;
      readonly revealIndex: number;
      readonly revealAt: number;
    };

export type DecryptoCommand = DecryptoPublicCommand | DecryptoInternalCommand;
