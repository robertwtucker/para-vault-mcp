# para-vault-mcp

An [MCP](https://modelcontextprotocol.io) server that exposes a [PARA-method](https://fortelabs.com/blog/para/) [Obsidian](https://obsidian.md) vault as structured tools — so an agent can find your active projects, surface their next actions, and write to your daily note without you copy-pasting markdown.

Built first for the maintainer's own vault. Generalizable second: see [Vault expectations](#vault-expectations) for what v0.1 currently assumes, and [#2](https://github.com/robertwtucker/para-vault-mcp/issues/2) for the v0.2 plan to make it configurable.

## Status

v0.1 — five tools, MIT-licensed, validated end-to-end against a real PARA vault. Known issues and roadmap tracked openly in [GitHub Issues](https://github.com/robertwtucker/para-vault-mcp/issues).

## Tools

| Name                  | Purpose                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `find_project`        | Search active projects in `1-Projects/` by name fragment or tag.                                       |
| `next_action`         | Return the next action for a project (frontmatter `next-action`, falling back to top unchecked task).  |
| `capture`             | Append an idea, URL, or note to today's daily-note **Captures** section.                               |
| `log_work`            | Append a work-log entry (something done or worked on) to today's daily-note **Work Log** section.      |
| `daily_review_status` | Report whether today's daily note exists, the count of unprocessed top-level `.md` files in `0-Inbox/`, and the parsed state of any `## End-of-Day Check` checkboxes.                            |

All write tools auto-prefix the standard markdown list bullet (`- `) and are idempotent against double-prefixing.

## Install

### Claude Code

```sh
# Clone and build
git clone https://github.com/robertwtucker/para-vault-mcp.git
cd para-vault-mcp
pnpm install
pnpm run build

# Register with Claude Code (replace path with your vault)
claude mcp add para-vault \
  -e OBSIDIAN_VAULT_PATH=/absolute/path/to/your/vault \
  -- node $(pwd)/dist/index.js
```

Restart Claude Code, then run `/mcp` — you should see `para-vault` listed with all five tools.

### Claude Desktop

Build the server the same way as above (`pnpm install && pnpm run build`), then add an `mcpServers` entry to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "para-vault": {
      "command": "node",
      "args": ["/absolute/path/to/para-vault-mcp/dist/index.js"],
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

Restart Claude Desktop after editing. Both `args` and `OBSIDIAN_VAULT_PATH` must be absolute paths — Claude Desktop does not expand `~` or shell variables.

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

v0.1 hardcodes the following structure. Vaults that match it work out of the box; vaults that don't will need either renames or a wait for [#2](https://github.com/robertwtucker/para-vault-mcp/issues/2).

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

**Project frontmatter** referenced by `next_action`:

```yaml
---
type: project
status: active # find_project returns only `status: active`
next-action: "..." # next_action returns this if present
tags: [...]
---
```

When `next-action` is absent from frontmatter, `next_action` falls back to the first unchecked `- [ ] ...` task in the body.

## Development

```sh
pnpm install         # install dependencies (lockfile-strict)
pnpm test            # run the full test suite (47 tests as of v0.1)
pnpm run typecheck   # tsc --noEmit
pnpm run build       # clean + tsc; rebuilds dist/ hermetically
pnpm run dev         # run from source via tsx (no rebuild required)
```

The `prebuild` lifecycle hook clears `dist/` before every `tsc` invocation, so the compiled output never drifts into a strict superset of the current source tree.

## Known issues (v0.1)

Tracked in full at [GitHub Issues](https://github.com/robertwtucker/para-vault-mcp/issues). Summary:

- **[#1](https://github.com/robertwtucker/para-vault-mcp/issues/1)** — `parseFrontmatter` silently swallows YAML parse errors. A malformed frontmatter block (e.g., unquoted `#` characters in a value) currently returns empty data instead of surfacing the error. Workaround: quote frontmatter values that contain markdown syntax.
- **[#2](https://github.com/robertwtucker/para-vault-mcp/issues/2)** — daily-note section names (`Captures`, `Work Log`) and PARA folder names are hardcoded. v0.2 will extract these to configuration so non-default vault structures are supported without code changes.
- **[#3](https://github.com/robertwtucker/para-vault-mcp/issues/3)** — append-to-daily-note tools use a read-modify-write cycle protected by atomic-rename, which guards against partial-file state but not against lost updates under concurrent writers (e.g., Claude Code and Claude Desktop running against the same vault simultaneously). Single-client use is safe.

## Contributing

Issues and PRs welcome. The codebase is small, fully typed, and TDD-built; running `pnpm test` should always be green on `main`. Contributors don't need to use PARA themselves — the test suite uses a fixture vault that doesn't depend on the maintainer's personal data.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development conventions, commit style, and PR process.

## License

MIT. See [LICENSE](./LICENSE).
