import {
  UNDERCOVER_CATEGORIES,
  UNDERCOVER_CATEGORY_NAMES,
} from '@game-judge/game-engine/games/undercover/public';

export { UNDERCOVER_CATEGORY_MIN_ACTIVE_PAIRS } from '@game-judge/game-engine/games/undercover/public';

export const UNDERCOVER_DASHBOARD_CATEGORIES = UNDERCOVER_CATEGORIES.map((id) => ({
  id,
  name: UNDERCOVER_CATEGORY_NAMES[id],
}));
