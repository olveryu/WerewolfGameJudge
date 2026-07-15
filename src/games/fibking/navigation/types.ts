/** FibKing-owned root route extensions. */

export type FibConfigRouteParams =
  | {
      readonly gameType: 'fibking';
      readonly mode: 'create';
    }
  | {
      readonly gameType: 'fibking';
      readonly mode: 'edit';
      readonly roomCode: string;
    };

export interface FibGuideRouteParams {
  readonly gameType: 'fibking';
  readonly roomCode?: string;
}
