# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **September dependency sweep.** Runtime: `@11ty/gray-matter` 2.1.0 → 3.0.0 (#56), `globby` 16.2.2 → 16.2.4 (#53). Dev: `@types/node` 26.1.2 → 26.4.0 (#54), `vitest` 4.1.10 → 4.1.11 (#55), `tsx` 4.23.1 → 4.23.13 (#59). CI: `github/codeql-action` 4.37.3 → 4.37.9 (#57), `pnpm/action-setup` 6.0.9 → 6.0.10 (#58, SHA pin refreshed and the `# v6` comment kept). 148/148 tests and typecheck clean on the combined stack.
- **`@11ty/gray-matter` 3.0.0 carries `js-yaml` 4.3.1 → 5.4.1, which stops resolving bare YAML dates to `Date` objects.** `updated: 2026-05-01` now parses to the string `'2026-05-01'`. No observable change to any tool response: `readDateField` consults the raw YAML scalar before the parsed value — a defensive ordering introduced in v0.4 to preserve calendar dates across TZ offsets (#14) — so the parser's date typing was already irrelevant to `due`, `updated`, and `last-reviewed`. Verified branch by branch against both versions: plain dates, anchored dates (`updated: &u 2026-05-01`), quoted dates, empty frontmatter, and invalid YAML all produce identical `find_project` output, including `daysSinceUpdate` and the `updated_since` boundary. Two second-order js-yaml 5 changes are inert here: YAML merge keys (`<<:`) are no longer merged, which vault frontmatter does not use, and `load('')` now throws, which gray-matter guards before it reaches the parser — an empty `---\n---` block still parses cleanly rather than registering a `parseFailures` entry. The one code change the bump did force is recorded under Removed below.

### Removed

- **`readDateField`'s `value instanceof Date` branch.** js-yaml 5 dropped the timestamp type from its default schema, so a date field can no longer arrive as a `Date`: a bare `2026-05-01` resolves to the string `"2026-05-01"`, and an explicit `!!timestamp` tag fails to resolve at all. The branch — which re-routed js-yaml's UTC-midnight `Date` objects through `parseDateString` to get local midnight — became unreachable, confirmed by instrumenting it with a throw and running the full suite for zero hits. Removed rather than kept belt-and-braces, unlike the `extractRawFrontmatter` workaround in `frontmatter.ts`, whose defect returns the moment its cache opt-out does; this branch only returns if js-yaml is downgraded. No behavior change — anchored dates (`updated: &u 2026-05-01`) now take the string fallback, which routes through the same `parseDateString` and yields an identical local-midnight `Date`. The regression test's assertions are unchanged and still guard the invariant; only its comment, which described the removed branch, was corrected (#60).

### Fixed

- **`pnpm typecheck` no longer skips `test/`.** `tsconfig.json` includes only `src/**` and excludes `test`, so the command CONTRIBUTING and every implementation plan name as a gate passed unconditionally for test files — and Vitest didn't cover the gap, since esbuild strips types without checking them. A type-incoherent test file went green twice over. Adds `tsconfig.test.json`, which extends the base config to include `test/**` and `vitest.config.ts`, and runs it from `typecheck` *after* the base config rather than in place of it — the test config relaxes `rootDir` to reach `test/`, which suppresses the `TS6059` the base config raises when a `src/` file imports from outside `src/`, and CI never runs `pnpm build`. The base config itself is untouched, so `pnpm build` still emits `dist/` from `src/` alone. The new config restates `exclude` rather than inheriting it — `extends` carries the base `exclude`, which lists `test`, and `exclude` filters `include`, so overriding `include` alone yields an empty program that exits 0. No pre-existing errors surfaced across the 15 files now in the program (#48).

### Security

- **`nanoid` advisory GHSA-2v37-7h3g-55p8 cleared** (high severity, dev-only — reachable through `vitest`, never in the published package). `postcss` 8.5.25 → 8.5.28 pulls `nanoid` 3.3.16 → 3.3.18; `pnpm audit` reports no known vulnerabilities. Lockfile-only: no `package.json` range changed and no `pnpm.overrides` entry was reintroduced, the approach v0.5 deliberately retired. Contrary to the plan recorded in #49, a `vitest`/`vite` major is not the mechanism — `vitest` 5.0.0 installs and passes the suite unchanged but leaves `nanoid` at 3.3.16, since `vite` 8.1.5 already satisfies its peer range and pnpm reuses the existing `postcss` pin. Regeneration was the only lever needed, and it was cheap because the September sweep had already brought the tree current: direct-dep drift is `zod` 4.4.3 → 4.5.4 and `@types/node` 26.4.0 → 26.4.1, plus transitive `vite` 8.1.5 → 8.2.2. `zod` sits on the MCP tool-schema path, so it was checked rather than assumed — booting the server over an in-memory transport on both versions yields byte-identical `tools/list` JSON Schema across all five tools (#49).

## [0.6.0] - 2026-08-26

v0.6 makes absence a signal. v0.4 made the row honest — a swallowed parse error surfaced in `dateErrors` instead of masquerading as a confident `[]`. v0.5 made the content fresh — a pointer to a file became the file's live bytes. Both assume the record reaches the caller at all, and that assumption was wrong: a project whose `_project.md` won't parse is dropped by every frontmatter-derived filter in `find_project`, so the file most likely to be mangled by concurrent edits was exactly the one that could not raise its hand. `find_project` now returns an envelope carrying an unfilterable `parseFailures` census, and `daily_review_status` stops reporting a present-but-unreadable daily note as missing. SDK-registration and test-architecture hygiene ride along under Changed and Fixed without claiming the theme.

### Added

- **`find_project`: `parseFailures` response channel.** Every project whose frontmatter had a parse problem is reported on every call — regardless of active filters, and excluded from `sort` and `limit`, though the census itself is always returned sorted by name so callers get a stable ordering to rely on. Carries `{name, path, error?, dateErrors?}` built from the filesystem-derived name and path, the only channel that survives a parse failure. Present as an empty array when the vault is clean, so "no failures" is stated rather than inferred from a missing key. Closes the gap surfaced 2026-08-14: a project whose `_project.md` fails to parse is excluded by all five frontmatter-derived filters (`status`, `area`, `#tag`, `stale_days`, `updated_since`), so the file most likely to be mangled by concurrent edits was precisely the one that could not raise its hand (#47).
- **`daily_review_status`: `dailyNoteError`.** Present when today's daily note exists but could not be read, carrying the underlying error message (#42).

### Changed

- **Breaking:** `find_project`'s top-level response changed from a bare array to `{projects, parseFailures}`. Clients reading the response as an array must read `.projects`. Per-project entry shape is unchanged. The internal `findProjects` helper changed return type to match — the diagnostic has to be produced where filtering happens, since that is the only place still holding the rows the filters drop (#47).
- `find_project` tool description rewritten to document the `parseFailures` channel and the `status` / `area` / `#tag` exclusions, which were previously undocumented alongside the already-documented `stale_days` / `updated_since` ones (#47).
- `daily_review_status`: `dailyNoteExists` now reports `true` — not `false` — for a present-but-unreadable daily note, for every caller regardless of `include_body`. Previously the sole existence signal collapsed any read failure into "missing"; see Fixed below for the mechanism and the new `dailyNoteError` field (#42).
- `registerTool` now receives `z.object(...)` rather than a raw Zod shape, moving off the overload deprecated in `@modelcontextprotocol/server@2.0.0`. No wire-schema change; the new integration test confirms `tools/list` emits identical JSON Schema (#44).
- SDK-level integration test added, driving real `tools/list` / `tools/call` over an in-process transport, including a guard that `serverInfo.version` matches `package.json` — the pair that drifted during v0.5 (#43).
- CHANGELOG subsections reordered to the Keep a Changelog 1.1.0 canonical sequence (Added → Changed → Deprecated → Removed → Fixed → Security) across every release section; `[0.4.0]`'s non-canonical `### Performance` heading is preserved verbatim, placed between Fixed and Security (#46).

### Fixed

- **`find_project`: a present-but-unreadable `_project.md` no longer reports as absent.** `loadProject` read the file through a single bare `catch` that collapsed every failure — permissions, IO error, `EISDIR` — into "no `_project.md` here," so a corrupted project reported `hasProjectFile: false` and was silently absent from the `parseFailures` census as well as every frontmatter-derived filter. Now discriminates on `ENOENT`: an absent file still reports `hasProjectFile: false` with no `readError`, while an unreadable one reports `hasProjectFile: true` plus a new `readError` field and appears in `parseFailures`. Note the semantic change even for callers who never hit this case: `hasProjectFile` now means "the file exists," not "the file was usable" — a present-but-unreadable file previously reported `false` and now reports `true` (#50).
- **`daily_review_status`: a present-but-unreadable daily note no longer reports as missing.** `inboxStatus` read today's note through a single `readFile(...).catch(() => undefined)` serving as existence flag, end-of-day-check source, and body source at once, so any read failure collapsed into `dailyNoteExists: false`. Now discriminates on `ENOENT` within the same read: an absent note still reports `false`, while an unreadable one reports `true` plus `dailyNoteError`, and populates the body envelope's `error` when `include_body` is set (#42).
- `readBodyBounded` and `buildBodyEnvelope` now agree on how to flag content of exactly `maxBytes`. Aligned on strict `<`, not `<=`: `readBodyBounded`'s oversized branch feeds `buildBodyEnvelope` a buffer of exactly `maxBytes`, and only the strict comparison routes that input into the UTF-8 code-point backoff, so `<=` would have returned a split code point (#41).
- `parseFrontmatter`: `@11ty/gray-matter` memoized a parse failure as a success. The library caches by content before validating: `matter.cache[file.content] = file` runs before `parseMatter` returns, so when parsing throws on invalid YAML the cache retains the partially-initialized object — `data: {}`, no error — and every later call with byte-identical content returns that cached shell instead of re-parsing. On the long-lived stdio server this meant a corrupted project's frontmatter error surfaced once, on the session's first parse of that file, then silently vanished from every subsequent call. Fixed by passing a truthy options object (`matter(raw, {})`), which bypasses both the cache read and the cache write. Distinct from the v0.4 `extractRawFrontmatter` workaround, which addressed a different failure in the same cache (the library stripping its own non-enumerable `matter` property) and remains in place deliberately — this fix does not supersede it.

### Security

- `js-yaml` (transitive, via `@11ty/gray-matter`) bumped from `4.3.0` to `4.3.1`, closing GHSA-5p4m-2wfm-xmqj (quadratic CPU consumption in `!!omap` resolution on crafted YAML). Runtime-reachable through `parseFrontmatter`, which is on the `find_project` hot path this release extends — every call parses YAML the vault's own files supply. `@11ty/gray-matter`'s declared range (`^4.2.0`) already permitted the patched version; only the lockfile needed refreshing, no dependency-range change was needed.

## [0.5.0] - 2026-08-01

v0.5 makes freshness structural. v0.4 made silences loud — the tool refused to return a confident-looking answer that had swallowed an error. v0.5 extends that discipline to a subtler class of wrong answers: stale ones. `daily_review_status` gains opt-in body-return so the daily-review opener hands out live on-disk state instead of pointers, closing the stale-in-context-copy failure mode surfaced during 2026-07 dogfooding. Modernization work (pnpm 11, Node baseline ≥22, SDK v2 folded) rides along under Changed but does not claim the theme — version-currency is a thematic cousin at best.

### Added

- **`daily_review_status`: `include_body` / `include_previous_body`** — opt in to receive today's on-disk daily-note body (and/or the previous note's) directly in the tool response, under new `dailyNoteBody` / `previousDailyNoteBody` fields carrying `{content, truncated, totalBytes}`. Fresh read at call time — no caching, so successive calls reflect live edits, closing the "reviewer trusts a stale in-context copy" failure mode surfaced during 2026-07-08 dogfooding. Truncation is a hard 128 KB cap with UTF-8-safe backoff; `truncated: true` surfaces the cut explicitly rather than silently trimming.

### Changed

- **Dependency baseline modernized.** Runtime: `zod` 3.25 → 4.4 (#32), `date-fns` 3.6 → 4.4 (#33), `globby` 14 → 16 (#31). Dev: `typescript` 5.9 → 6.0 (#35), `@types/node` 20 → 26 (#34), `github/codeql-action` v3 → v4 (#30). No tool-facing API changes; 101/101 tests, typecheck, and `pnpm audit` remain clean on the combined stack. The `pnpm.overrides` block (hono, qs, vite) has been removed — natural upstream resolution now picks safe versions across the whole tree (vitest 4 permits vite 8 as a peer), and the pins had become dead weight constraining future updates.
- **Dev tooling and CI: next-major sweep.** Dev: `typescript` 6.0 → 7.0 (#37). CI: `actions/setup-node` v6 → v7 (#36; the only substantive v7 change is an ESM migration, transparent on Node ≥20 runners), `github/codeql-action` pinned from floating `v4` to `v4.37.3` (#38). Typecheck and tests remain green across Node 20/22/24; no tool-facing changes.
- **Breaking:** minimum Node bumped from `>=20` to `>=22`. CI matrix `[20, 22, 24]` → `[22, 24, 26]`. Release workflow's publish job now runs on Node 22 (long-tail LTS). Users still on Node 20 will see an engines mismatch on install — Node 20 has exited active LTS; the pre-1.0 semver posture makes this legitimate in a minor.
- pnpm bumped `10.33.0` → `11.18.0`. Dev-only; no user impact.
- MCP SDK migrated from `@modelcontextprotocol/sdk@^1.30.0` to the v2 scoped-package layout via `@modelcontextprotocol/codemod`. Tool contracts unchanged; response shapes unchanged. See `docs/design/2026-08-01-sdk-v2-investigation.md` for the migration receipt.

### Security

- `@modelcontextprotocol/sdk` pin tightened from `^1.0.0` to `^1.30.0`, picking up the SDK's widened `@hono/node-server` range and closing GHSA-frvp-7c67-39w9 (path traversal in `serve-static` on Windows via encoded backslash).

## [0.4.0] - 2026-06-26

v0.4 makes failures fail loudly. v0.3 left a handful of silent failure modes — a typoed `updated:` value silently skewed sort and staleness filters; a wikilink alias didn't match `area:` queries despite literally naming the area; a timestamp with a TZ offset got UTC-sliced into a different calendar date. v0.4 makes each one either correct or loud: bad YAML no longer parses as good YAML, typos surface in a new `dateErrors` field instead of returning `[]`, every Obsidian wikilink shape collapses to one canonical form, and CodeQL is on for workflow hardening. The `find_project` hot path now caches parsed dates and the `daily_review_status` opener parallelizes its independent I/O — bonuses inside the same theme.

### Changed

- **Breaking:** `find_project` response: `lastReviewed` field renamed to `last_reviewed` to match the YAML field name and the snake_case MCP API convention. Clients reading the response by field name will need to update; sort token (the public API the response field name didn't appear in) was already `last_reviewed`. The internal `SORT_KEY_MAP` indirection is gone (#20) — adding a new identity-mapped (non-date) sort key now requires only the Zod enum and `ProjectSortKey` union, not the prior four parallel touch sites.
- `find_project` response: new `dateErrors?: Array<{field, value}>` field carrying per-field date-parse failures.
- `find_project` tool description and parameter `.describe()` strings refreshed to reflect post-#18 exclusion criteria and the expanded `area:` normalization surface.

### Fixed

- `find_project`: `area: [[Foo]]` written **unquoted** in YAML — parsed by js-yaml as a nested array — no longer silently drops to `undefined` (#15).
- `find_project`: `area:` written as a wikilink alias (`[[Areas/Health|Health]]`) or path target (`[[Areas/Health]]`) now matches the alias / last path segment instead of yielding `areas/health|health` (#16).
- `find_project`: date fields carrying a timezone offset (e.g. `due: 2026-06-30T20:00:00-08:00`) now preserve the user's calendar date instead of UTC-slicing into a different day (#14).
- `find_project`: impossible dates in frontmatter (e.g. `updated: 2026-13-45`) no longer roll over silently via `new Date()`; the project still appears in results but the bad value surfaces in the new `dateErrors` field (#18).
- `parseFrontmatter`: works around a latent `@11ty/gray-matter` bug where the library's cache stripped its own non-enumerable `matter` property on repeated parses of identical content. Raw YAML now extracted from the input string directly, sidestepping the upstream issue.
- `find_project`: `value instanceof Date` fallback in the date-field reader now caches local-midnight Date instead of js-yaml's UTC midnight, eliminating a residual TZ inconsistency in the `updated_since` filter (triggered by YAML anchors and other edge inputs).

### Performance

- `daily_review_status`: `inboxStatus` parallelizes its three independent I/O ops (daily-note read, inbox readdir+stat, previous-daily-note readdir) via `Promise.all`. Wall-clock collapses from sum-of-three to slowest-of-three on cold cache (#17).
- `find_project`: parsed `Date` objects are stashed alongside the display strings on each `ProjectSummary` and reused by both `daysSinceUpdate` and the `updated_since` filter. Eliminates the per-project re-parse the filter previously did on every call (#19).

### Security

- `ci.yml` test job declares an explicit `permissions: contents: read` block; the implicit broad `GITHUB_TOKEN` is no longer inherited (#22).
- `pnpm/action-setup` (the only third-party action) is pinned to a commit SHA in both `ci.yml` and `release.yml`; Dependabot's `github-actions` ecosystem keeps the SHA current (#23).
- CodeQL static analysis enabled for the `javascript-typescript` and `actions` language packs, using the `security-and-quality` query suite, scheduled weekly (catches workflow misconfiguration that linters miss).
- Replaced the unmaintained `gray-matter` (pinned `js-yaml@^3.13.1`) with `@11ty/gray-matter` (`js-yaml@^4.2.0`), clearing GHSA-h67p-54hq-rp68 (quadratic-complexity DoS in js-yaml v3 via repeated YAML merge keys).

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

[Unreleased]: https://github.com/robertwtucker/para-vault-mcp/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/robertwtucker/para-vault-mcp/releases/tag/v0.6.0
[0.5.0]: https://github.com/robertwtucker/para-vault-mcp/releases/tag/v0.5.0
[0.4.0]: https://github.com/robertwtucker/para-vault-mcp/releases/tag/v0.4.0
[0.3.0]: https://github.com/robertwtucker/para-vault-mcp/releases/tag/v0.3.0
[0.2.0]: https://github.com/robertwtucker/para-vault-mcp/releases/tag/v0.2.0
[0.1.0]: https://github.com/robertwtucker/para-vault-mcp/releases/tag/v0.1.0
