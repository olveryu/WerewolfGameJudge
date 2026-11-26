import type { ComponentType } from 'react';

import { dicePreview } from './dicePreview';
import { secrethitlerPreview } from './secrethitlerPreview';

export type PreviewPage = 'home' | 'config' | 'room';

export interface PreviewPopulation {
  readonly otherPlayers: number;
  readonly seatedOthers: number;
}

export const defaultPreviewPopulation: PreviewPopulation = { otherPlayers: 3, seatedOthers: 3 };

interface PreviewOption {
  readonly id: string;
  readonly label: string;
}

/** A game supplies its scenarios and real page composition; the host supplies the controls. */
export interface PreviewGame {
  readonly id: string;
  readonly label: string;
  readonly phases: readonly PreviewOption[];
  readonly viewers: (phase: string) => readonly PreviewOption[];
  readonly Screen: ComponentType<{
    readonly phase: string;
    readonly viewer: string;
    readonly page: PreviewPage;
    readonly population: PreviewPopulation;
  }>;
}

export const previewGames: readonly PreviewGame[] = [secrethitlerPreview, dicePreview];

export function getPreviewGame(id: string): PreviewGame {
  const game = previewGames.find((candidate) => candidate.id === id);
  if (game === undefined) throw new Error(`Unknown preview game: ${id}`);
  return game;
}
