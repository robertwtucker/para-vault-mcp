# MCP SDK v2 Investigation — v0.5 fold-or-defer gate

**Date:** 2026-08-01
**Branch:** chore/sdk-v2-scratch (off feat/v0.5)
**Decision:** DEFER

## What the codemod did

Ran `@modelcontextprotocol/codemod@2.0.0` (`v1-to-v2` migration) against `src/`:

```
pnpm add -D @modelcontextprotocol/codemod
pnpm exec mcp-codemod v1-to-v2 src/
```

Output (verbatim, `/tmp/codemod-output.txt`):

```
@modelcontextprotocol/codemod — v1-to-v2

Scanning /Users/robert/projects/para-vault-mcp/src...

Changes: 2 across 2 file(s)

Warnings (1):
  /Users/robert/projects/para-vault-mcp/src/server.ts:30 - [WARNING] Could not automatically migrate .tool() call. Manual migration required.

package.json updated:
  package.json
    Removed: @modelcontextprotocol/sdk
    Added:   @modelcontextprotocol/server

1 location(s) marked with @mcp-codemod-error comments — search your code to find them:
  grep -r '@mcp-codemod-error' "/Users/robert/projects/para-vault-mcp/src"

This codemod doesn't reformat its output. Run your formatter on the changed file(s):
  e.g. prettier --write src/index.ts src/server.ts

Run your package manager to install the new packages.

Migration complete. Review the changes and run your build/tests.
```

`git diff --shortstat` (after `pnpm install` to resolve the new `@modelcontextprotocol/server` dependency into the lockfile):

```
4 files changed, 75 insertions(+), 749 deletions(-)
```

`git diff --name-only`:

```
package.json
pnpm-lock.yaml
src/index.ts
src/server.ts
```

Source-only delta (`src/` files, excluding manifest/lockfile churn):

```
2 files changed, 3 insertions(+), 2 deletions(-)
```

**Mechanical changes applied cleanly:**
- `src/index.ts`: import path rewritten — `StdioServerTransport` now imported from `@modelcontextprotocol/server/stdio` instead of `@modelcontextprotocol/sdk/server/stdio.js`.
- `src/server.ts`: import path rewritten — `McpServer` now imported from `@modelcontextprotocol/server` instead of `@modelcontextprotocol/sdk/server/mcp.js`.
- `package.json`: `@modelcontextprotocol/sdk: ^1.30.0` removed, `@modelcontextprotocol/server: ^2.0.0` added.
- `pnpm-lock.yaml`: regenerated to resolve `@modelcontextprotocol/server@2.0.0` (the package does exist and resolves on the registry — confirmed via `pnpm install`, no network/publish issues).

**Unresolved rewrite (1 site):** the codemod could not migrate the tool-registration call in `src/server.ts:31`:

```ts
/* @mcp-codemod-error Could not automatically migrate .tool() call. Manual migration required. */
mcp.tool(tool.name, tool.description, tool.inputSchema, async (args: unknown) => handler(args));
```

This site is inside `buildServer`'s `for (const tool of tools)` loop — it is the single registration call shared by all five tools (`find_project`, `next_action`, `capture`, `log_work`, `daily_review_status`), so the unresolved rewrite is not an isolated inconvenience; it blocks registration of the entire tool surface.

**Verified breakage.** Rather than stop at the codemod's own warning, confirmed the practical impact by running the project's checks against the codemod output as-applied:

```
pnpm typecheck
# src/server.ts(31,9): error TS2339: Property 'tool' does not exist on type 'McpServer'.

pnpm test
# Test Files  2 failed | 11 passed (13)
#      Tests  4 failed | 97 passed (101)
# TypeError: mcp.tool is not a function
#   (test/server.test.ts — buildServer dispatch tests)
```

`McpServer` in v2 does not expose `.tool()` at all — the SDK's v2 API requires `registerTool(name, config, handler)`, where `config` bundles `description`/`inputSchema`/`outputSchema` into an object rather than the v1 positional-argument form. This is a genuine API-surface change, not a rename the codemod could apply mechanically without inspecting how each call site's arguments should be regrouped.

## Criteria evaluation

- [x] Diff touches only src/index.ts + src/server.ts + src/tools/*.ts (plus expected package.json/pnpm-lock.yaml manifest churn from the dependency swap) — none of the five `src/tools/*.ts` files were touched.
- [ ] No tool contracts changed (Zod schemas, response shapes) — **unresolved**, cannot confirm: the one call site the codemod couldn't migrate is the shared registration path for all five tools' contracts, and v2's `registerTool` takes a differently-shaped config argument. Whether the resulting contract is externally observable-identical is exactly the judgment the codemod declined to make.
- [ ] Codemod completed with no unresolved rewrites — **false**. One `@mcp-codemod-error` marker at `src/server.ts:30`, and it is load-bearing: `pnpm typecheck` fails and `pnpm test` fails 4/101 tests with the code left as the codemod produced it.
- [x] LOC delta < 100 — true in isolation (src-only: 5 lines; full diff including lockfile: 75 insertions / 749 deletions, dominated by lockfile regeneration, not new logic). This criterion alone would have supported fold, but it is not decisive on its own per the fold rule (all four criteria must hold).

## Decision

**Defer.** The specific criterion that triggers deferral: *"Codemod leaves unresolved rewrites"* (defer criteria, item 2). The codemod's own warning ("Could not automatically migrate `.tool()` call. Manual migration required.") is not cosmetic — leaving the code as the codemod produced it fails `pnpm typecheck` (`TS2339: Property 'tool' does not exist on type 'McpServer'`) and fails 4 of 101 tests (`TypeError: mcp.tool is not a function`). The failing call site is the single shared tool-registration path for all five tools, so this isn't a narrow gap — it's the crux of the migration, and completing it requires hand-writing the `registerTool(name, config, handler)` call for each tool, which is a judgment call about how each tool's `description`/`inputSchema` maps into v2's config object, not a mechanical rename. That also leaves criterion 2 ("no tool contracts changed") genuinely unresolved rather than confirmed clean.

v0.6 becomes the SDK v2 migration release. v0.5 ships on `@modelcontextprotocol/sdk@^1.30.0`. The scratch branch `chore/sdk-v2-scratch` is preserved as a reference; **DO NOT MERGE**. A follow-up issue should name v0.6's SDK v2 migration as its own release story, cross-linking this doc — the manual `registerTool` conversion for all five tools is now a scoped, known piece of work rather than an open unknown.

## Lab-note observation

Codemod-driven MCP SDK migration on a small (five-tool) server got the boring 80% for free — import paths and the package manifest rewrote cleanly and instantly — but stopped exactly at the one call site that mattered most: tool registration, the API surface every MCP server exists to expose. The codemod was honest about the gap (an explicit `@mcp-codemod-error` marker rather than a silent miss or a guessed rewrite), which made the failure legible rather than hidden — `pnpm typecheck` caught it immediately, and it would have been just as loud in CI. The practical lesson for anyone running this codemod: don't trust "Migration complete" as a green light — grep for `@mcp-codemod-error` markers and run the type checker before believing the diff is done, because a codemod that mechanically handles imports can still leave the one method call that defines your server's actual contract for a human to finish by hand.

## Addendum — 2026-08-01: reversed to FOLD

On review, the controller determined the DEFER criteria above were miscalibrated for this specific case. The "unresolved rewrite" that drove the defer decision is a single call site inside a `for` loop that already covers all five tools — not five separate migrations, one shared loop body — and the manual fix is a ~5-line shape change from v1's positional `.tool(name, description, inputSchema, cb)` to v2's `registerTool(name, config, cb)`. That's scoped, mechanical work well within v0.5, not v0.6-scope migration effort. The decision is reversed to **FOLD**.

Applied on `feat/v0.5`: re-ran `@modelcontextprotocol/codemod@2.0.0` (`v1-to-v2`), which reproduced the exact same output as the investigation run (same two files touched for import/manifest rewrites, same single `@mcp-codemod-error` marker at `src/server.ts:30-31`). Hand-applied the `registerTool` migration at that site — confirmed the v2 signature against `node_modules/@modelcontextprotocol/server`'s type declarations (`registerTool(name, { title?, description?, inputSchema?, outputSchema?, annotations?, icons?, _meta? }, cb)`), which matches the shape predicted above. Removed the `@modelcontextprotocol/codemod` dev dependency afterward since it was a one-shot tool.

Outcome: `pnpm typecheck` clean, `pnpm test` 101/101 passing. Fold commit: `db91871` (`chore(sdk): migrate to @modelcontextprotocol/server v2 via codemod + manual registerTool patch`).
