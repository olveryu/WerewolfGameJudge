/**
 * createAvalonBoardInfoSections: board composition grouped by faction,
 * pinned against the fixed AVALON_BOARDS tables (AU-06 characterization).
 */
import { createAvalonBoardInfoSections, isAvalonRoleId } from '../avalonRoomAdapter';

describe('createAvalonBoardInfoSections', () => {
  it('groups the 5-player board into evil and good sections in board order', () => {
    const sections = createAvalonBoardInfoSections(5);
    expect(sections?.map((section) => section.title)).toEqual(['坏人', '好人']);
    expect(sections?.[0]?.items).toEqual([
      { roleId: 'morgana', displayName: '莫甘娜', count: 1 },
      { roleId: 'assassin', displayName: '刺客', count: 1 },
    ]);
    expect(sections?.[1]?.items).toEqual([
      { roleId: 'merlin', displayName: '梅林', count: 1 },
      { roleId: 'percival', displayName: '派西维尔', count: 1 },
      { roleId: 'loyalServant', displayName: '忠臣', count: 1 },
    ]);
  });

  it('aggregates duplicate roles and keeps section totals at the player count', () => {
    for (const playerCount of [6, 7, 8, 9, 10]) {
      const sections = createAvalonBoardInfoSections(playerCount);
      const total = sections
        ?.flatMap((section) => section.items)
        .reduce((sum, item) => sum + item.count, 0);
      expect(total).toBe(playerCount);
    }
    const seven = createAvalonBoardInfoSections(7);
    expect(seven?.[0]?.items.map((item) => item.roleId)).toEqual(['morgana', 'assassin', 'oberon']);
    const six = createAvalonBoardInfoSections(6);
    expect(six?.[1]?.items).toContainEqual({
      roleId: 'loyalServant',
      displayName: '忠臣',
      count: 2,
    });
  });

  it('returns null for player counts outside the board table', () => {
    expect(createAvalonBoardInfoSections(4)).toBeNull();
    expect(createAvalonBoardInfoSections(11)).toBeNull();
  });
});

describe('isAvalonRoleId', () => {
  it('accepts board role ids and rejects foreign strings', () => {
    expect(isAvalonRoleId('merlin')).toBe(true);
    expect(isAvalonRoleId('oberon')).toBe(true);
    expect(isAvalonRoleId('werewolf')).toBe(false);
    expect(isAvalonRoleId('')).toBe(false);
  });
});
