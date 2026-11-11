import {
  DRAWGUESS_WORD_CATEGORIES,
  DRAWGUESS_WORD_CATEGORY_NAMES,
} from '@game-judge/game-engine/games/drawguess/public';

export const DRAWGUESS_DASHBOARD_CATEGORIES = DRAWGUESS_WORD_CATEGORIES.map((id) => ({
  id,
  name: DRAWGUESS_WORD_CATEGORY_NAMES[id],
}));
