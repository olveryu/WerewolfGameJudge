import { WOLF_ROBOT_GATE_ROLES } from '../../roles/wolfRobot';
import type { GameState } from '../protocol/types';

/** Whether the current step is waiting for the Wolf Robot hunter-status acknowledgement. */
export function isWolfRobotHunterStatusGatePending(state: GameState): boolean {
  return (
    state.nightStep?.kind === 'inStep' &&
    state.nightStep.stepId === 'wolfRobotLearn' &&
    state.wolfRobotReveal?.learnedRoleId != null &&
    WOLF_ROBOT_GATE_ROLES.includes(state.wolfRobotReveal.learnedRoleId) &&
    state.wolfRobotHunterStatusViewed === false
  );
}
