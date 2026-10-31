# Agent configuration wiring

This is a human document. It is not loaded as agent rules, and it contains
no project rules. It explains where the agent files live, what size they
may be, how to change them, and how to check that they load. Project rules
live only in the files listed under Layout; do not add rules here.

## Layout

| File                               | Role                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `AGENTS.md` (repository root)      | Global rules: snapshot, commands, boundaries, conventions, output rule, pointers. |
| `packages/game-engine/AGENTS.md`   | Engine package rules.                                                             |
| `packages/api-worker/AGENTS.md`    | Worker package rules.                                                             |
| `src/AGENTS.md`                    | Client and room-shell rules.                                                      |
| `e2e/AGENTS.md`                    | End-to-end test rules.                                                            |
| `.agents/skills/<name>/SKILL.md`   | One workflow per skill directory.                                                 |
| `scripts/validate-agent-files.mjs` | The validator. Run through `pnpm run validate:agents`.                            |
| This document                      | Wiring only.                                                                      |

There are no generated copies of these files and no per-host adapters.
Each file above is the one place its rules live. A rule that belongs in
one area goes in that area's file; the root file points to it instead of
repeating it.

## Budgets

Budgets are checked, not advisory. A file over budget is split by area or
shortened; a rule is never kept over budget by trimming its evidence.

| File                    | Budget                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| Root `AGENTS.md`        | At most 150 lines and 32 KiB.                                                                  |
| Each nested `AGENTS.md` | At most 100 lines.                                                                             |
| Each `SKILL.md`         | At most 500 lines; body under 5000 tokens; description at most 1024 characters.                |
| Skill frontmatter       | Only the six allowed keys: name, description, license, compatibility, metadata, allowed-tools. |

Counts are lines and bytes as reported by `wc -l -c`.

## How to add or change a rule

1. Decide which single file owns the rule: root for global rules, the
   nested file for its area, a skill for a repeatable workflow.
2. Edit that file only. Do not edit any other file to restate the rule.
3. State the rule once, in the owning file, in short specific sentences.
   Anywhere else, use a one-line pointer naming the nested file, skill,
   contract test, or deciding code instead of repeating the rule. If no
   enforcing check verifies what the pointer claims, delete the pointer
   instead of keeping unverified text.
4. Every factual sentence must trace to deciding code (the function or
   test that enforces it), not to UI copy, memory, or an older rule file.
   If the deciding code cannot be found, the rule does not go in.
5. Keep the file within budget. If the change breaks the budget, move
   detail to the owning nested file or skill and leave a pointer.
6. Run `pnpm run validate:agents`, then the scoped checks for the
   changed area. Fix validator failures in the source file; never edit
   validator output or work around a failure by rewording evidence away.

## How to add or change a skill

1. Create or edit one directory under `.agents/skills/<name>/`, named
   exactly as the skill's frontmatter name.
2. Keep the skill to one workflow: purpose, entry conditions, ordered
   steps, verification, and failure handling. Project rules stay in the
   area files; the skill points to them.
3. Apply the same evidence rule as for rules: paths, symbols, counts,
   and command names must exist in the repository at the time of writing.
   The validator checks only the path forms listed under Validator
   purpose, as warnings, and does not check symbols, counts, or
   command names.
4. Run `pnpm run validate:agents` and fix failures in the skill source.

## How to change the validator

The validator is code, not rules. Change it only to enforce a contract
stated in this document (frontmatter shape, file budgets, dead-reference
warnings, the duplicate-heading report, or the absence of the named
tool-specific files).
When the validator gains a check, record the check here in one line so a
human can see what is enforced without reading the script.

## How to verify loading

No special command verifies loading. Use any agent session:

1. Start a fresh session in the repository.
2. Ask the agent to confirm it has read the root `AGENTS.md` and to name
   the nested file that governs the area of the first task.
3. If it cannot confirm, stop: the files are misplaced or unread, and no
   rule in them can be relied on until placement is fixed.
4. When work moves to a new area, confirm the new area's nested file
   before relying on its rules.

A confirmation is evidence of loading only for that session. It does not
prove any rule is correct; correctness comes from the deciding code and
the validator.

## Validator purpose

The validator proves the file set is well-formed and internally
consistent. It checks budgets, frontmatter shape, and the absence of
the named tool-specific files (failures). It also scans markdown files
for mentioned paths that do not exist, as warnings only (never
failures): paths rooted at `src/`, `packages/`, `scripts/`, `e2e/`,
`docs/`, or `agents/`; paths rooted at `.agents/`; and `references/...`
paths resolved against the mentioning file's skill root (the nearest
ancestor directory holding a `SKILL.md`, or, under `.agents/skills/`,
the skill directory itself), checked only when such a skill root
exists. Mentions with placeholders (`<...>`), braces (`{...}`), or
globs (`*`) never yield a candidate, and a matched candidate
containing a `..` segment is skipped; so are a rooted-path match
preceded by `.` and a `.agents/` or `references/...` match that is a
suffix of a longer path. Bare filenames, other path forms, and
`references/...` mentions in files with no skill root are never
checked. It reports duplicate top-level headings (a report only, never
a failure). It does not check symbols, section pointers, or whether a
cited number matches its deciding test. It does not prove that a rule
matches the product's intent, that cited code behaves as described, or
that any agent loaded the files. Those need code review, contract tests,
and the loading check above.

## Maintenance notes

- Review this document whenever the layout changes: a new nested file,
  a moved skill directory, or a new validator check must be recorded
  here, or the next editor will work from a stale map.
- The previous synchronization system and its generated copies are
  removed. Do not recreate generated copies or adapters; if a consumer
  cannot read the generic files, record that as an open item instead of
  adding a workaround file.
- This document replaces the previous explanation of the old system.
  Pointers that named the old explanation must point here or be deleted.
