/**
 * AU-23 QA follow-up: the adapter separates the matching identity
 * (id, the real role) from the presented identity (displayId). A
 * disguised role's card face - including the English subtitle that
 * RoleCardContent derives from displayId - must never leak the real
 * role, while the public pool (showRealIdentity) keeps real names.
 */
import { toRevealRoleData } from '../WerewolfRoleCardAdapter';

describe('toRevealRoleData display identity (AU-23)', () => {
  it('presents mirrorSeer as the seer while keeping the real id for matching', () => {
    const data = toRevealRoleData('mirrorSeer');
    expect(data.id).toBe('mirrorSeer');
    expect(data.displayId).toBe('seer');
    expect(data.name).toBe('预言家');
    expect(data.alignment).toBe('god');
  });

  it('presents drunkSeer as the seer too', () => {
    const data = toRevealRoleData('drunkSeer');
    expect(data.id).toBe('drunkSeer');
    expect(data.displayId).toBe('seer');
    expect(data.name).toBe('预言家');
  });

  it('shows the real identity for the public pool', () => {
    const data = toRevealRoleData('mirrorSeer', { showRealIdentity: true });
    expect(data.id).toBe('mirrorSeer');
    expect(data.displayId).toBe('mirrorSeer');
    expect(data.name).toBe('灯影预言家');
    expect(data.alignment).toBe('villager');
  });

  it('labels a dual seer without changing its presented identity', () => {
    const data = toRevealRoleData('seer', { seerLabel: 2 });
    expect(data.name).toBe('2号预言家');
    expect(data.displayId).toBe('seer');
  });

  it('keeps displayId equal to id for undisguised roles', () => {
    const data = toRevealRoleData('wolf');
    expect(data.id).toBe('wolf');
    expect(data.displayId).toBe('wolf');
  });
});
