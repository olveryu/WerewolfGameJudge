// The UI gate's Stylelint configuration lives in scripts/ui-lint/stylelint.gate.mjs; this file only
// hands it to editor integrations. The gate itself runs through `pnpm run lint:ui`.
export { default } from './scripts/ui-lint/stylelint.gate.mjs';
