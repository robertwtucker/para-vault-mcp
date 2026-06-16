# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/robertwtucker/para-vault-mcp/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/robertwtucker/para-vault-mcp/releases/tag/v0.3.0
[0.2.0]: https://github.com/robertwtucker/para-vault-mcp/releases/tag/v0.2.0
[0.1.0]: https://github.com/robertwtucker/para-vault-mcp/releases/tag/v0.1.0
