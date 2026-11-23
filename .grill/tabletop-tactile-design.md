# Grill: Tabletop tactile design

Date: 2026-11-22

## Intent

Give the app a beautiful, visibly physical tabletop-game feel, inspired by the physical cards,
collectible framing, art presentation, hand interactions, and overall atmosphere of Hearthstone,
Yu-Gi-Oh!, and Magic: The Gathering.

## Constraints

- Design first: use the standalone interactive mock and the user's explicitly approved direction
  for production work; simplified mock pages do not define game behavior.
- Cover all user-facing pages, all games, admin, and error pages; exclude the developer benchmark.
- Prioritize mobile for all pages and adapt for desktop.
- Retain game art, functionality, content, and game flows. Use fictional mock data.
- Avoid childish styling, heavy black outlines and shadows, loud colors, dirty textures, flatness,
  overcrowding, and inconsistency.

## Key decisions

- Decision: Clean, refined, noticeable tabletop tactility across the site. Reason: it should
  look like real tabletop objects without being exaggerated. Alternative: worn or cartoonish.
- Decision: Interactive cards stand out from informational panels through depth; nested panels
  are boards with separate pieces, not layers of thick frames. After reviewing the mock, the user
  chose the first information-panel option, “清爽纸板”, over the soft and warm alternatives,
  keeping its shown edge and shadow.
- Decision: Buttons resemble physical keys, with a short press and return. Secondary actions
  have lighter treatment. After reviewing the mock, the user chose the first “桌游按键” option
  over the soft and dark-outline alternatives, keeping its shown edge and shadow thickness.
  Other controls use tactile forms appropriate to their function.
- Decision: Role cards may have refined collectible frames; action cards have simpler frames
  for readability. Selected cards lift and carry a clear indicator; unavailable controls keep
  their content readable. Role card front and back are visual explorations, not a reveal redesign.
- Decision: Keep collectible rarity information, but make its color treatment subordinate to the
  clean paperboard surface; use a gold edge and clear marker for the selected item. Reason: rarity
  remains useful, while selection must not be confused with the item's tier. Alternative: retain
  the current prominent rarity glow.
- Decision: Keep the existing primary and faction colors, with limited complementary material
  colors. Use the blue-grey background as the main direction, and build atmosphere through the
  components rather than a decorative scene. After reviewing the mock, the user chose the first,
  recommended blue-grey tabletop over the textured and warm alternatives, keeping it clean and
  almost untextured and using it consistently across the site; other component choices remain open.
- Decision: Use a shared card structure across games with small game-specific details.
- Decision: Deliver all page mockups together, with major card and button states per game,
  without simulating full game rules. Provide a page directory and simulated main navigation.
- Decision: Compare two or three distinct treatments per major component, including some
  previously unselected directions; users can mix components and review the combination.
  Complete pages initially use one recommended style. Compare key pages against main.
- Decision: After reviewing the gallery, choose the recommended treatment for all component
  categories: the clean blue-grey background, tabletop keys, clean paperboard, clean tactile
  interactive cards, refined role-card frames, fan-shaped action cards, tactile seats, clean
  recessed fields, tactile dialogs, and clean table panels. The user subsequently approved
  starting production implementation; unfinished mock pages do not define production behavior.
- Decision: Preview locally, using high-fidelity existing art and fictional data. The user
  communicates choices in chat; preference persistence and online deployment are unnecessary.

## Open questions

- Screen-specific adaptations where production content is richer than the simplified mock remain
  to be checked against existing functionality and the selected visual language.

## Out of scope

- Role reveal interaction or animation redesign.
- Full simulation of game rules and real game actions.
- Production data and developer-only performance benchmark.
