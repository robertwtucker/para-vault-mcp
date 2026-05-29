# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - YYYY-MM-DD

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

[Unreleased]: https://github.com/robertwtucker/para-vault-mcp/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/robertwtucker/para-vault-mcp/releases/tag/v0.2.0
[0.1.0]: https://github.com/robertwtucker/para-vault-mcp/releases/tag/v0.1.0
