/** Pictionary-owned root route extensions. */

export type PictionaryConfigRouteParams =
  | {
      readonly gameType: 'pictionary';
      readonly mode: 'create';
    }
  | {
      readonly gameType: 'pictionary';
      readonly mode: 'edit';
      readonly roomCode: string;
    };

export interface PictionaryGuideRouteParams {
  readonly gameType: 'pictionary';
  readonly roomCode?: string;
}
