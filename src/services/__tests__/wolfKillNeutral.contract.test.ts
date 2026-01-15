/**
 * Wolf Kill Neutral Judge Contract Test
 * 
 * RED LINE: wolfKill must stay neutral - can target ANY seat.
 * This test exists to prevent anyone from accidentally adding restrictions to wolfKill.
 * 
 * Voting restrictions belong in WOLF_MEETING_VOTE_CONFIG, not wolfKill schema.
 */

import { SCHEMAS } from '../../models/roles/spec/schemas';
import { WOLF_MEETING_VOTE_CONFIG } from '../../models/roles/spec/wolfMeetingVoteConfig';

describe('wolfKill Neutral Judge Contract', () => {
  it('wolfKill schema must NOT have forbiddenTargetRoleIds (RED LINE)', () => {
    const wolfKillSchema = SCHEMAS.wolfKill;
    
    // RED LINE: wolfKill must stay neutral - no forbidden targets
    expect(wolfKillSchema).not.toHaveProperty('forbiddenTargetRoleIds');
    
    // Also verify constraints is empty (neutral judge)
    expect(wolfKillSchema.constraints).toEqual([]);
  });

  it('WOLF_MEETING_VOTE_CONFIG SHOULD have forbiddenTargetRoleIds for meeting vote restrictions', () => {
    // Meeting vote restrictions are defined here, not on wolfKill
    expect(WOLF_MEETING_VOTE_CONFIG.forbiddenTargetRoleIds).toBeDefined();
    expect(WOLF_MEETING_VOTE_CONFIG.forbiddenTargetRoleIds).toContain('spiritKnight');
    expect(WOLF_MEETING_VOTE_CONFIG.forbiddenTargetRoleIds).toContain('wolfQueen');
  });

  it('WOLF_MEETING_VOTE_CONFIG is separate from SCHEMAS', () => {
    // wolfMeetingVote should NOT be in SCHEMAS (to not affect SchemaId type)
    expect(SCHEMAS).not.toHaveProperty('wolfMeetingVote');
    
    // WOLF_MEETING_VOTE_CONFIG is a standalone config object
    expect(WOLF_MEETING_VOTE_CONFIG).toBeDefined();
  });
});
