# Grill: Paper surface design

Date: 2026-11-23

## Intent

Give large and small cards, headers, and bottom hand cards a coherent paper feel that fits the
existing blue-grey tabletop style.

## Constraints

- Keep the finish clean and refined, not aged or overtly handmade.
- Make paper edges and soft depth visible while keeping texture fine enough for drawing and reading.
- Preserve existing layouts, colors, interactions, and hand-card fan.

## Key decisions

- Decision: Draw on a flat sheet with a fine edge, soft shadow, and nearly white interior.
  Alternative considered: a thick board or a stack of paper.
- Decision: Make hand cards slightly thicker and more prominent than the drawing sheet.
  Alternative considered: equally thin sheets or a stronger playing-card effect.
- Decision: Use a flat paper information strip for headers and thinner paper for information
  cards, keeping actual controls identifiable without a heavy button treatment.
  Alternative considered: similarly thick information cards and hand cards.
- Decision: Implement directly without preparing a mock.
- Decision: Apply the paper material to all actual action buttons, not only hand cards, without
  turning titles or status text into raised buttons or changing the original room seats.
- Status bar follow-up: the user likes the compact A direction for short werewolf status text,
  but not its original long-text layout.
- Decision: The user chose the D "tabletop turn slip" mock for long werewolf statuses: a paper
  strip with a small phase illustration, a subtle edge, a prominent action, and visible context
  and progress. Alternative considered: C, with a larger illustration beside the content.
  The detailed behavior and implementation have not yet been confirmed.
- Decision: When the phase and voting progress do not fit on one line, let the progress wrap
  naturally and remain fully visible rather than shrinking or truncating the text.
- Decision: When a player has no action, show the current waiting status in the prominent
  content position instead of inventing an instruction.
- Decision: Change the small illustration with the current status or action, while retaining text
  for the meaning; for example, use a ballot box for voting and a neutral mark for waiting.
- Decision: Review mock states for werewolf, Avalon, and Secret Hitler before implementing the
  status-bar changes. Whether the latter two share the same treatment remains open.
- Decision: The werewolf voting status should also show which seats have not voted, not just
  the number of submitted votes.
- Decision: Show unsubmitted voter seats by seat number only, including for Secret Hitler.
- Decision: Do not display the explanatory sentence about only revealing aggregate votes in the
  Secret Hitler status bar; the user wants it consistent with Avalon. This does not change vote
  privacy or reveal rules.
- Decision: Use the same main voting-status wording, "投票中", for all three games, alongside
  submitted counts and unsubmitted seat numbers; preserve the specific voting phase in context.
- Decision: After all votes are submitted, show that the result is awaiting reveal and display
  the countdown when available; do not show an empty unsubmitted-seat list.
- Decision: Make status text compact by removing unnecessary explanations and combining related
  information on one line where possible, rather than truncating content to enforce two lines.
- Decision: Keep a single instruction such as the werewolf seer prompt as continuous, equally
  weighted text below the phase line; let it wrap naturally rather than splitting it into
  separate primary and secondary messages.
- The user confirmed the corrected seer-prompt placement, is satisfied with the other states in
  the compact three-game mock, and authorized implementation for all three games.

## Open questions

- Exact visual balance of texture, edges, and shadows remains subject to reviewing the implementation.
- The user requested a werewolf status-bar mock before implementation. Avalon and Secret Hitler
  have now been included in the mock; implementation details and voting-privacy boundaries must
  be verified during implementation.
