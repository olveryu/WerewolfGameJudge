export interface GameStatsProps {
  readonly userId: string;
  readonly onGamesPlayedChange?: (gamesPlayed: number | null) => void;
}
