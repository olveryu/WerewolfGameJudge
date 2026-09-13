import type { FashionTutorialDecisionId, FashionTutorialDocumentId } from './tutorialContent';

export type FashionTutorialPhase = 'intro' | 'documents' | 'knowledge' | 'finalDecision' | 'ending';

export interface FashionTutorialState {
  readonly phase: FashionTutorialPhase;
  readonly selectedDocumentId: FashionTutorialDocumentId | null;
  readonly knowledgeAcknowledged: boolean;
  readonly finalDecisionId: FashionTutorialDecisionId | null;
}

export function createFashionTutorialState(): FashionTutorialState {
  return {
    phase: 'intro',
    selectedDocumentId: null,
    knowledgeAcknowledged: false,
    finalDecisionId: null,
  };
}

export function startFashionTutorial(state: FashionTutorialState): FashionTutorialState {
  if (state.phase !== 'intro') throw new Error('[FAIL-FAST] Fashion tutorial already started');
  return { ...state, phase: 'documents' };
}

export function chooseFashionTutorialDocument(
  state: FashionTutorialState,
  selectedDocumentId: FashionTutorialDocumentId,
): FashionTutorialState {
  if (state.phase !== 'documents') {
    throw new Error('[FAIL-FAST] Fashion tutorial document choice is not available');
  }
  return {
    ...state,
    phase: 'knowledge',
    selectedDocumentId,
    knowledgeAcknowledged: false,
  };
}

export function acknowledgeFashionTutorialKnowledge(
  state: FashionTutorialState,
): FashionTutorialState {
  if (state.phase !== 'knowledge' || state.selectedDocumentId === null) {
    throw new Error('[FAIL-FAST] Fashion tutorial knowledge is not available');
  }
  return { ...state, phase: 'finalDecision', knowledgeAcknowledged: true };
}

export function chooseFashionTutorialFinalDecision(
  state: FashionTutorialState,
  finalDecisionId: FashionTutorialDecisionId,
): FashionTutorialState {
  if (
    state.phase !== 'finalDecision' ||
    state.selectedDocumentId === null ||
    !state.knowledgeAcknowledged
  ) {
    throw new Error('[FAIL-FAST] Fashion tutorial final decision is not available');
  }
  return { ...state, phase: 'ending', finalDecisionId };
}

export function canCompleteFashionTutorial(state: FashionTutorialState): boolean {
  return (
    state.phase === 'ending' &&
    state.selectedDocumentId !== null &&
    state.knowledgeAcknowledged &&
    state.finalDecisionId !== null
  );
}
