/** Root-navigation screens contributed by a concrete client game module. */

import type React from 'react';

export interface GameNavigationContribution {
  readonly configScreen: React.ComponentType;
  readonly guideScreen: React.ComponentType | null;
  readonly notepadScreen: React.ComponentType | null;
}
