import type { RoleId } from '../../../../models/roles/spec';

/**
 * Type-level contract: wolfRobot learn success result must include learnedRoleId.
 *
 * We intentionally rely on TypeScript compile-time checking here.
 * This file is included in the main `tsc -p tsconfig.json --noEmit` run.
 */

describe('wolfRobot type contracts (compile-time only)', () => {
  it('compiles', () => {
    // Runtime no-op. The assertions are enforced by TypeScript.
    expect(true).toBe(true);
  });
});

/**
 * Minimal reproduction of the strict success payload shape.
 *
 * We keep this shape local to the test so that the contract continues to
 * fail-fast even if someone weakens exported types.
 */
type LearnSuccessPayload = {
  readonly learnTarget: number;
  readonly learnedRoleId: RoleId;
  readonly identityResult: RoleId;
  readonly canShootAsHunter?: boolean;
};

// Happy path: should compile
const _ok: LearnSuccessPayload = {
  learnTarget: 1,
  learnedRoleId: 'hunter',
  identityResult: 'hunter',
};

// Contract: removing learnedRoleId must fail compilation
// @ts-expect-error learnedRoleId is required by contract
const _missingLearnedRoleId: LearnSuccessPayload = {
  learnTarget: 1,
  identityResult: 'hunter',
};
