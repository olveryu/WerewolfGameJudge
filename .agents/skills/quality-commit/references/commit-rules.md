# Commit rules

## Message format

Conventional Commits, English, lowercase imperative:

```
<type>(<scope>): <description>
```

- Type: one of `feat`, `fix`, `refactor`, `perf`, `style`, `chore`, `test`, `docs`, `release`, `build`, `ci`, `revert`. This is the enforced type enum in `commitlint.config.js`; do not invent a type.
- Scope: the main changed directory or module name (for example `roomscreen`, `api-worker`, `game-engine`).
- Description: state specifically what was done. No vague wording.

If the user already provided a commit message, use it directly. Do not override it with a generated one.

Generate the message from the inspected diff (`git status --short`, `git diff`, `git diff --cached`), not from the request wording alone. The message must describe the change set that is actually staged.

## Enforced limits (only what the configuration enforces)

- Header: at most 100 characters. Enforced by `header-max-length: 100` in `commitlint.config.js`, plus the subject-case rule.
- Body and footer lines: no line-length rule exists in the configuration. The previous version of this skill (and of the global rules) stated that every body and footer line must be at most 100 characters. That is not enforced. Keep body lines wrapped as a style preference, and never state that a long body line fails the commit-message check. If the configuration changes, re-verify before restating the rule.

## Staging procedure

1. Inspect `git status --short`, `git diff`, and `git diff --cached`.
2. Stage only the agreed paths:

   ```bash
   git add -- <approved-paths>
   ```

   Never run an automatic add-all for a manual commit. The release script's own add-all belongs to the release script only.

3. Inspect the staged diff before committing. If the staged diff contains anything outside the agreed scope, unstage it and re-inspect.
4. Commit:

   ```bash
   git commit -m "<commit message>"
   ```

   For a multi-line message, prefer a heredoc with pre-wrapped lines. The commit-time checks run automatically. Never bypass them.

5. Push only on an explicit push request:

   ```bash
   git push
   ```

   If the push is rejected as non-fast-forward, report blocked and recommend pulling with rebase first, then re-running the skill. Force push is forbidden in all forms.

## Constraints carried from the previous version

- Bypassing checks is forbidden.
- Force push is forbidden.
- No business-logic change is authorised by a quality failure alone. Only the minimum change needed to eliminate the reported issue, within the approved scope, is in scope for this skill.
