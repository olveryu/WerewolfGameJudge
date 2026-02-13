# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Conventional Commits](https://www.conventionalcommits.org/).

> Older entries (before v1.0.197) can be found via `git log --oneline`.

## [1.0.210] - 2026-02-13

- fix(components): add borderRadius prop to Avatar for proper photo clipping
- fix(auth): streamline button accessibility and loading states in EmailForm and LoginOptions
- refactor: overhaul authentication components and styles
- feat(theme): add spacer elements to ThemeSelector for better layout
- style(screens): move InstallMenuItem from menu to footer link
- fix(web): PWA install button visible on iOS Chrome + close guide without permanent dismiss

## [1.0.209] - 2026-02-13

- feat(web): add PWA install-to-homescreen menu item
- chore(web): remove wechat-specific compat code

## [1.0.208] - 2026-02-13

- feat(web): add wechat webview detection and browser redirect guide

## [1.0.207] - 2026-02-13

- docs: comprehensive content accuracy update across all docs and READMEs

## [1.0.206] - 2026-02-13

- docs: update test counts to 166 suites / 2643 tests

## [1.0.205] - 2026-02-13

- fix: add Sentry.captureException to all critical catch blocks
- fix: use friendly chinese error messages for all user-facing errors
- fix(services): add missing error logging + user-friendly auth error messages
- refactor(tests): remove unused waitForNightActive helper function
- docs: add three-layer error handling and friendly message rules to instructions

## [1.0.204] - 2026-02-13

- feat(room): show BoardInfoCard in all phases, collapsed during ongoing/ended

## [1.0.203] - 2026-02-13

- fix: repo-wide bug fixes from audit

## [1.0.202] - 2026-02-13

- fix(room): prefer share sheet on mobile, clipboard on desktop

## [1.0.200] - 2026-02-13

- fix(room): prefer clipboard over navigator.share on web

## [1.0.198] - 2026-02-13

- fix(room): discriminate share result type and add readLastRoom catch
- fix(HomeScreen): improve last room number loading on focus

## [1.0.197] - 2026-02-13

- feat(navigation): add URL linking for page restore on refresh
