# para-vault-mcp

An [MCP](https://modelcontextprotocol.io) server that exposes a [PARA-method](https://fortelabs.com/blog/para/) [Obsidian](https://obsidian.md) vault as structured tools — so an agent can find your active projects, surface their next actions, and write to your daily note without you copy-pasting markdown.

Section names and PARA folder paths are configurable via `_system/PARA-conventions.md`. Defaults match the maintainer's vault; vaults that diverge declare their conventions and continue to work without code changes.

## Status

v0.4 — five tools, MIT-licensed, published on npm as `@robertwtucker/para-vault-mcp`. The review-shaped tool design from v0.3 (filtering, sorting, and limits on `find_project`; rich state in `daily_review_status`) now sits on a v0.4 foundation that makes failures fail loudly: typoed dates surface in a new `dateErrors` response field instead of returning `[]`, every Obsidian wikilink shape for `area:` (including aliases and path targets) resolves to the same canonical form, frontmatter dates preserve the user's calendar date across timezones, and CodeQL guards the CI. Roadmap tracked openly in [GitHub Issues](https://github.com/robertwtucker/para-vault-mcp/issues).

## Tools

| Name                  | Purpose                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `find_project`        | List PARA projects in `1-Projects/` with optional filtering, sorting, and a limit.                     |
| `next_action`         | Return the next action for a project (frontmatter `next-action`, falling back to top unchecked task).  |
| `capture`             | Append an idea, URL, or note to today's daily-note **Captures** section.                               |
| `log_work`            | Append a work-log entry (something done or worked on) to today's daily-note **Work Log** section.      |
| `daily_review_status` | Report the state of today's daily-review surface: today's note existence, inbox items and count, the prior daily note's path for reconciliation, and `## End-of-Day Check` checkboxes.          |

All write tools auto-prefix the standard markdown list bullet (`- `) and are idempotent against double-prefixing.

## Install

The recommended install is via `npx` — no clone, no build. Both install snippets below pin `@latest` so the MCP client picks up new releases on the next restart; without the tag, npx caches the first-resolved version and won't auto-update.

### Claude Code

```sh
claude mcp add para-vault \
  -e OBSIDIAN_VAULT_PATH=/absolute/path/to/your/vault \
  -- npx -y @robertwtucker/para-vault-mcp@latest
```

Restart Claude Code, then run `/mcp` — you should see `para-vault` listed with all five tools.

### Claude Desktop

Add an `mcpServers` entry to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "para-vault": {
      "command": "npx",
      "args": ["-y", "@robertwtucker/para-vault-mcp@latest"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/absolute/path/to/your/vault"
      }
    }
  }
}
```

Config file location:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Restart Claude Desktop after editing. `OBSIDIAN_VAULT_PATH` must be an absolute path — Claude Desktop does not expand `~` or shell variables.

### From source (contributors)

```sh
git clone https://github.com/robertwtucker/para-vault-mcp.git
cd para-vault-mcp
pnpm install
pnpm run build
# Then point your MCP client at `node /path/to/para-vault-mcp/dist/index.js`.
```

### Requirements

- Node.js ≥ 20
- pnpm 10.x (the repo pins to 10.33.0 for contributor reproducibility)
- An Obsidian vault following the structure below

## Configuration

One required environment variable:

| Variable              | Purpose                                                                   |
| --------------------- | ------------------------------------------------------------------------- |
| `OBSIDIAN_VAULT_PATH` | Absolute path to your Obsidian vault root. No default; required to start. |

## Vault expectations

The defaults below match the maintainer's vault. Vaults with different folder names or section names declare their conventions in `_system/PARA-conventions.md` (see [Customizing conventions](#customizing-conventions) below).

```
<vault root>/
├── 0-Inbox/
│   └── Daily/
│       └── YYYY-MM-DD.md       # daily notes; created automatically by write tools if missing
├── 1-Projects/
│   └── <Project Name>/
│       └── _project.md         # project shell with frontmatter (status, next-action, etc.)
├── 2-Areas/
├── 3-Resources/
└── 4-Archive/
```

**Daily-note sections** referenced by the write tools (must exist in your daily-note template):

- `## Captures` (for `capture`)
- `## Work Log` (for `log_work`)

**Project frontmatter** referenced by the project tools:

```yaml
---
type: project
status: active # find_project's `status` filter does case-insensitive equality match
next-action: "..." # next_action returns this if present
area: "..." # find_project's `area` filter normalizes every Obsidian wikilink shape (incl. aliases and path targets) before exact match
updated: 2026-06-10 # find_project sorts and filters by staleness against this
last-reviewed: 2026-06-10 # find_project can sort by this
due: 2026-07-08 # find_project can sort by this
tags: [...]
---
```

`find_project` returns every project in `1-Projects/` by default — vocabulary on `status` is yours, not the tool's. Pass `status: "active"` (or whatever you use) to filter. When `next-action` is absent from frontmatter, `next_action` falls back to the first unchecked `- [ ] ...` task in the body. Date fields are read whether written quoted (`updated: "2026-06-10"`), as bare YAML dates (`updated: 2026-06-10`), or as full timestamps with offsets (`updated: 2026-06-10T20:00:00-08:00`) — `find_project` reports the user's calendar date rather than UTC-slicing the parsed instant. Frontmatter date values that don't parse (e.g. `2026-13-45`) surface in the per-project `dateErrors` array on the response so the caller can flag them, rather than silently rolling over to a different date via JavaScript's `Date` constructor.

### Customizing conventions

By default, `para-vault-mcp` assumes Robert's PARA folder layout (`0-Inbox/`, `0-Inbox/Daily/`, `1-Projects/`) and daily-note section names (`## Captures`, `## Work Log`, `## End-of-Day Check`). If your vault uses different names, create `_system/PARA-conventions.md` with frontmatter:

```yaml
---
capture-section: Inbox
work-log-section: Done
end-of-day-check-section: Wrap Up
daily-notes-folder: Journal
inbox-folder: Capture
projects-folder: Projects
---
```

Any unspecified key keeps its default. Folder paths must resolve inside the vault — values that escape `OBSIDIAN_VAULT_PATH` are rejected at startup.

## Development

```sh
pnpm install         # install dependencies (lockfile-strict)
pnpm test            # run the full test suite (91 tests as of v0.3)
pnpm run typecheck   # tsc --noEmit
pnpm run build       # clean + tsc; rebuilds dist/ hermetically
pnpm run dev         # run from source via tsx (no rebuild required)
```

The `prebuild` lifecycle hook clears `dist/` before every `tsc` invocation, so the compiled output never drifts into a strict superset of the current source tree.

## Known limitations

- **Plugin-generated sections are unsupported.** Tools operate on static markdown sections. If you map a tool to a section whose contents are produced by an Obsidian plugin (`tasks`, `dataview`, fenced code blocks owned by a plugin), behavior is undefined.
- **Config file path is hardcoded** to `_system/PARA-conventions.md`. A future release may add an env-var override.
- **Single-process concurrency only.** Writes are serialized in-process; running multiple servers against the same vault is not protected.

## Contributing

Issues and PRs welcome. The codebase is small, fully typed, and TDD-built; running `pnpm test` should always be green on `main`. Contributors don't need to use PARA themselves — the test suite uses a fixture vault that doesn't depend on the maintainer's personal data.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development conventions, commit style, and PR process.

## License

MIT. See [LICENSE](./LICENSE).
