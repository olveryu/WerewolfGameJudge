# Grill: Avalon and Secret Hitler room information

Date: 2026-11-20

## Intent

Learn from the werewolf room's information hierarchy so players can understand
the current situation at a glance while each game keeps its own visual tracks.

## Constraints

- Prioritize portrait phones while supporting desktop. Keep the complete room
  frame, seat board, and action hand in the prototype.
- If vertical space is insufficient, let the information area scroll rather
  than squeeze the seat board or hide the track.
- Keep public and private information separate, respecting each game's public
  and secret voting rules.

## Key decisions

- Decision: Put the current phase and action first, the persistent track second,
  and the latest public result last. Reason: Old results must not obscure what
  players need to do now.
- Decision: Show Avalon's five-round track from the start of daytime through
  the end, with player counts, special failure conditions, and results.
  Reason: Players can understand the mission at a glance. Alternatives
  considered: counts only, conditional display, and hiding the track in history.
- Decision: Keep all five mission cells visible on one screen; keep team
  membership on the seats rather than repeating the list in the header.
- Decision: Replace the configurable 3–5 rejection limit with a configurable
  3–5 proposal limit, default 5. The final proposed team is automatically
  approved without a vote; show the result for five seconds before the quest.
  Reason: Match the variant the user plays. Alternative considered: the
  original rule where reaching the rejection limit wins the game for evil.
- Decision: Apply the new rule to existing games too, without compatibility
  with the previous rule. Record the leader and team as automatically approved,
  without inventing ballots or vote totals.
- Decision: Show rejected proposals, the current proposal, and the final
  automatic-approval slot on a small track below Avalon's mission track. Reset
  for the next mission; retain an inactive track at game end.
- Decision: Warn everyone throughout the final nomination that the submitted
  team will be automatically approved. Keep the existing selection confirmation
  and clearly label it instead of adding another confirmation.
- Decision: Show Secret Hitler's two policy tracks with compact effect labels
  and clickable explanations, plus a persistent election-failure counter and
  its third-failure consequence. Reason: The tracks carry important public rules
  as well as progress.
- Decision: Put a three-cell election tracker below the policy tracks, with
  the third cell marked chaos. Failed elections and approved vetoes advance it;
  policy enactment resets it, not election of a government.
- Decision: Keep only the most recent public result in each game's header and
  full history in the existing bottom-hand entry. During a five-second result
  overlay, block other interactions and restore the previous interface and
  drafts afterward.
- Decision: Preserve in-progress drafts when viewing a track explanation; the
  explanation is read-only and does not pause the game.
- Decision: At game end, emphasize the winner while retaining the final track;
  detailed identities and history remain in their existing views.
- Decision: Build an interactive prototype before changing production UI.
  Include both games, key phase switching, track explanations, and history
  access, without connecting to a real game.

## Out of scope

- Redesigning the seat board or action hand.
- Moving private identities, unrevealed votes, or private investigations into
  public information.
