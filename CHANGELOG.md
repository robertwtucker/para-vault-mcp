# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-06-26

v0.4 makes failures fail loudly. v0.3 left a handful of silent failure modes — a typoed `updated:` value silently skewed sort and staleness filters; a wikilink alias didn't match `area:` queries despite literally naming the area; a timestamp with a TZ offset got UTC-sliced into a different calendar date. v0.4 makes each one either correct or loud: bad YAML no longer parses as good YAML, typos surface in a new `dateErrors` field instead of returning `[]`, every Obsidian wikilink shape collapses to one canonical form, and CodeQL is on for workflow hardening. The `find_project` hot path now caches parsed dates and the `daily_review_status` opener parallelizes its independent I/O — bonuses inside the same theme.

### Security

- `ci.yml` test job declares an explicit `permissions: contents: read` block; the implicit broad `GITHUB_TOKEN` is no longer inherited (#22).
- `pnpm/action-setup` (the only third-party action) is pinned to a commit SHA in both `ci.yml` and `release.yml`; Dependabot's `github-actions` ecosystem keeps the SHA current (#23).
- CodeQL static analysis enabled for `javascript-typescript` and `actions` query packs, scheduled weekly (catches workflow misconfiguration that linters miss).

### Fixed

- `find_project`: `area: [[Foo]]` written **unquoted** in YAML — parsed by js-yaml as a nested array — no longer silently drops to `undefined` (#15).
- `find_project`: `area:` written as a wikilink alias (`[[Areas/Health|Health]]`) or path target (`[[Areas/Health]]`) now matches the alias / last path segment instead of yielding `areas/health|health` (#16).
- `find_project`: date fields carrying a timezone offset (e.g. `due: 2026-06-30T20:00:00-08:00`) now preserve the user's calendar date instead of UTC-slicing into a different day (#14).
- `find_project`: impossible dates in frontmatter (e.g. `updated: 2026-13-45`) no longer roll over silently via `new Date()`; the project still appears in results but the bad value surfaces in the new `dateErrors` field (#18).
- `parseFrontmatter`: works around a latent `@11ty/gray-matter` bug where the library's cache stripped its own non-enumerable `matter` property on repeated parses of identical content. Raw YAML now extracted from the input string directly, sidestepping the upstream issue.
- `find_project`: `value instanceof Date` fallback in the date-field reader now caches local-midnight Date instead of js-yaml's UTC midnight, eliminating a residual TZ inconsistency in the `updated_since` filter (triggered by YAML anchors and other edge inputs).

### Changed

- `find_project` response: `lastReviewed` field renamed to `last_reviewed` to match the YAML field name and the snake_case MCP API convention; the internal `SORT_KEY_MAP` indirection is gone (#20). Adding a new sort key now requires touching two places, not four.
- `find_project` response: new `dateErrors?: Array<{field, value}>` field carrying per-field date-parse failures.
- `find_project` tool description and parameter `.describe()` strings refreshed to reflect post-#18 exclusion criteria and the expanded `area:` normalization surface.

### Performance

- `daily_review_status`: `inboxStatus` parallelizes its three independent I/O ops (daily-note read, inbox readdir+stat, previous-daily-note readdir) via `Promise.all`. Wall-clock collapses from sum-of-three to slowest-of-three on cold cache (#17).
- `find_project`: parsed `Date` objects are stashed alongside the display strings on each `ProjectSummary` and reused by both `daysSinceUpdate` and the `updated_since` filter. Eliminates the per-project re-parse the filter previously did on every call (#19).

## [0.3.0] - 2026-06-15

v0.3 makes review workflows direct. `find_project` gains filtering, sorting, and a limit so a daily review can ask for "oldest-stale active projects, top 5" in one call instead of a four-step grep-and-sort dance. `daily_review_status` returns the inbox-item list and the prior daily note's path alongside the existing state signals. Together they collapse the daily-review opener from four Bash operations to two tool calls.

### Added

- `find_project`: new optional filters (`status`, `area`, `stale_days`, `updated_since`), sort (`sort`, `order`), and `limit` params (#11). Inputs use snake_case; tool stays vocabulary-neutral on `status` — accepts any string for case-insensitive equality match rather than enumerating one user's PARA conventions.
- `find_project`: new response fields `updated`, `lastReviewed`, `daysSinceUpdate` lifted from frontmatter and computed against today (#11).
- `find_project`: `area` filter normalizes Obsidian `[[wikilink]]` brackets, quoting, and case before exact-matching, so a single query catches every presentation YAML produces (#11).
- `daily_review_status`: new `inboxItems` response field — every markdown file in the configured inbox folder as `{ name, path }`, sorted by mtime oldest-first for triage prioritization (#12).
- `daily_review_status`: new `previousDailyNotePath` response field — vault-relative path of the most recent daily note strictly before today, including weekly-review variants like `YYYY-MM-DD — Weekly Review.md` (#12).

### Changed

- `find_project`: sort default `'name'` is now deterministic regardless of platform. Previously ordering depended on globby's incidental filesystem traversal.

### Fixed

- `find_project`: `due:` frontmatter values written unquoted in YAML (e.g. `due: 2026-06-30`) are now correctly lifted. Previously silently dropped because the type check rejected js-yaml's parsed `Date` objects — affected every project in vaults using the natural YAML date form.

## [0.2.0] - 2026-05-28

v0.2 stops being maintainer-shaped. Section names and PARA folder paths are configurable via `_system/PARA-conventions.md`; defaults preserved. Published on npm as `@robertwtucker/para-vault-mcp`.

### Added

- Configurable section names and folder paths via `_system/PARA-conventions.md` frontmatter (#2). Defaults preserved — a vault without the file behaves exactly as v0.1.
- Folder-path values are containment-checked at config load; absolute paths and values resolving outside `OBSIDIAN_VAULT_PATH` are rejected (#9).
- `parseFrontmatter` now surfaces YAML errors via an `error` field; `find_project` results include `frontmatterError` when a project's `_project.md` has malformed frontmatter (#1).

### Changed

- `capture` inserts at the top of the section's primary bullet list rather than at section end (#8). `log_work` continues to append chronologically.
- Distributed on npm as `@robertwtucker/para-vault-mcp`; install is now `npx -y @robertwtucker/para-vault-mcp` (#5).

### Fixed

- Parallel writes to the same daily note no longer drop entries — per-path in-process serialization protects the read-modify-write cycle (#3).

## [0.1.0] - 2026-05-18

Initial release — five tools, MIT-licensed, validated end-to-end against a real PARA vault. Known issues and roadmap tracked openly in [GitHub Issues](https://github.com/robertwtucker/para-vault-mcp/issues).

### Added

- `capture`, `daily_review_status`, `find_project`, `log_work`, and `next_action` tools.
- Claude Code and Desktop installation instructions in README.
- PARA vault conventions documented in README.

[Unreleased]: https://github.com/robertwtucker/para-vault-mcp/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/robertwtucker/para-vault-mcp/releases/tag/v0.4.0
[0.3.0]: https://github.com/robertwtucker/para-vault-mcp/releases/tag/v0.3.0
[0.2.0]: https://github.com/robertwtucker/para-vault-mcp/releases/tag/v0.2.0
[0.1.0]: https://github.com/robertwtucker/para-vault-mcp/releases/tag/v0.1.0
