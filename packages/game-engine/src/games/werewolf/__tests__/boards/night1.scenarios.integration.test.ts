import { WEREWOLF_ROLE_DEFINITIONS, WEREWOLF_SHARED_STEPS } from '../../roles';
import { NIGHT_CASES } from './nightCases';

describe('Night-1 board scenarios through production commands', () => {
  it.each(NIGHT_CASES.map((nightCase) => [nightCase.name, nightCase] as const))(
    '%s',
    (_name, nightCase) => {
      expect(nightCase.play().outcome).toMatchSnapshot();
    },
  );

  it('reaches every declared night step in at least one scenario', () => {
    const declaredSteps = [
      ...WEREWOLF_ROLE_DEFINITIONS.flatMap((role) => role.steps.map((step) => step.id)),
      ...WEREWOLF_SHARED_STEPS.map((step) => step.id),
    ];
    const reachedSteps = new Set(
      NIGHT_CASES.flatMap((nightCase) => nightCase.play().outcome.steps),
    );

    expect(declaredSteps.filter((stepId) => !reachedSteps.has(stepId))).toEqual([]);
  });

  it('names every scenario uniquely', () => {
    const names = NIGHT_CASES.map((nightCase) => nightCase.name);

    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });
});
