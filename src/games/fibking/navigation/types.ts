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

export type FibGuideRouteExtension = Readonly<Record<never, never>>;
export type FibNotepadRouteParams = never;
