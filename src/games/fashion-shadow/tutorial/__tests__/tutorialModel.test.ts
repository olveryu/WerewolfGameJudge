import { FASHION_TUTORIAL_DECISIONS, FASHION_TUTORIAL_DOCUMENTS } from '../tutorialContent';
import {
  acknowledgeFashionTutorialKnowledge,
  canCompleteFashionTutorial,
  chooseFashionTutorialDocument,
  chooseFashionTutorialFinalDecision,
  createFashionTutorialState,
  startFashionTutorial,
} from '../tutorialModel';

describe('Fashion Shadow beginner tutorial', () => {
  it('contains all three ESG documents and all three final decisions', () => {
    expect(FASHION_TUTORIAL_DOCUMENTS.map(({ esg }) => esg).sort()).toEqual(['E', 'G', 'S']);
    expect(FASHION_TUTORIAL_DOCUMENTS.map(({ option }) => option)).toEqual(['A', 'B', 'C']);
    expect(FASHION_TUTORIAL_DECISIONS.map(({ option }) => option)).toEqual(['A', 'B', 'C']);
  });

  it.each(FASHION_TUTORIAL_DOCUMENTS.map(({ id }) => id))(
    'requires the ESG knowledge acknowledgement after choosing %s',
    (documentId) => {
      let state = startFashionTutorial(createFashionTutorialState());
      state = chooseFashionTutorialDocument(state, documentId);
      expect(state.phase).toBe('knowledge');
      expect(state.knowledgeAcknowledged).toBe(false);
      expect(() => chooseFashionTutorialFinalDecision(state, 'transparent')).toThrow(
        'final decision is not available',
      );

      state = acknowledgeFashionTutorialKnowledge(state);
      expect(state.phase).toBe('finalDecision');
      expect(state.knowledgeAcknowledged).toBe(true);
    },
  );

  it.each(FASHION_TUTORIAL_DECISIONS.map(({ id }) => id))(
    'can complete after one investigation, one knowledge acknowledgement, and final choice %s',
    (decisionId) => {
      let state = startFashionTutorial(createFashionTutorialState());
      state = chooseFashionTutorialDocument(state, 'governance');
      state = acknowledgeFashionTutorialKnowledge(state);
      state = chooseFashionTutorialFinalDecision(state, decisionId);

      expect(state.phase).toBe('ending');
      expect(canCompleteFashionTutorial(state)).toBe(true);
    },
  );

  it('does not allow skipping directly from the opening to completion', () => {
    const state = createFashionTutorialState();
    expect(canCompleteFashionTutorial(state)).toBe(false);
    expect(() => chooseFashionTutorialDocument(state, 'social')).toThrow(
      'document choice is not available',
    );
  });
});
