import {
  UNDERCOVER_CATEGORIES,
  UNDERCOVER_CATEGORY_NAMES,
} from '@game-judge/game-engine/games/undercover/public';

export const ADMIN_MOCK_UNDERCOVER_CATEGORIES = UNDERCOVER_CATEGORIES.map((id) => ({
  id,
  name: UNDERCOVER_CATEGORY_NAMES[id],
}));
