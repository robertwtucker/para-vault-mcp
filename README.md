# para-vault-mcp

An MCP server that exposes a PARA-method Obsidian vault as structured tools to any MCP-compatible client (Claude Code, Claude Desktop, etc).

> Status: pre-release. v0.1 ships when the four core tools are working end-to-end. Expanded README in v0.1.

## Tools (v0.1 target)

- `find_project` — search active projects in `1-Projects/` by name fragment or tag.
- `next_action` — return the next action for a project (frontmatter or top unchecked task).
- `log_to_today` — append a line/section to today's daily note at `0-Inbox/Daily/YYYY-MM-DD.md`.
- `daily_review_status` — does today's daily note exist and has the inbox been processed?

## License

MIT. See [LICENSE](./LICENSE).
