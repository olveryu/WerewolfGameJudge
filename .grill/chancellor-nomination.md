# Grill: Chancellor nomination

Date: 2026-11-20

## Intent

Make Secret Hitler chancellor nomination follow Avalon's public preselection and final-selection flow.

## Key decisions

- Keep Avalon's existing selection dialog visual design; defer the proposed redesign.
- Share the common selection dialog while keeping game rules and state in their respective games.
- The president publicly preselects one eligible candidate; the preselection is locked, visible on the seat, and survives reconnection and bot takeover changes.
- The final dialog starts with that candidate selected. The president can deselect and choose another eligible candidate before explicitly submitting.
- Show ineligible players with the reason they cannot be nominated.
- Unsubmitted choices are discarded on cancellation. After final submission, only the final nominee is highlighted, as in Avalon.
- Do not preserve the old nomination flow for existing games.

## Out of scope

- Changing other presidential actions, policy selection, or the visual design of the dialog.
