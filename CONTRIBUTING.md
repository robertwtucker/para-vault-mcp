# Contributing

Thanks for considering a contribution. This is a small, opinionated MCP server built around one maintainer's PARA workflow. Contributions are welcome with that scope in mind.

## Setup

See the [Development section in README.md](./README.md#development) for clone, install, build, test, and run commands. The lockfile is strict; please use `pnpm install --frozen-lockfile` so your local install matches CI.

## Before You Write Code

- **Open an issue first** for anything non-trivial — new tools, behavior changes, refactors, or anything that touches more than one file. Quick fixes (typos, a single-line bug) can skip the issue and go straight to a PR.
- **Reference the issue number** in your PR description and in commit messages where it applies (`fix(vault): handle empty Captures section (#N)`).

## Development Workflow

| Step                    | Command              | Must be green before commit |
| ----------------------- | -------------------- | --------------------------- |
| Run tests               | `pnpm test`          | yes                         |
| Typecheck               | `pnpm run typecheck` | yes                         |
| Build (hermetic, clean) | `pnpm run build`     | yes (if you changed source) |
| Run from source         | `pnpm run dev`       | optional, useful for smoke  |

The `prebuild` hook clears `dist/` before every `tsc` run, so the compiled output never drifts.

## Code Conventions

- **TDD.** Write the failing test first; then make it pass; then commit. For bug fixes, include a test that demonstrates the bug _before_ the fix in the same PR (and ideally the same commit).
- **SPDX headers** on every new `src/**/*.ts` file:

  ```ts
  /**
   * SPDX-FileCopyrightText: (c) <year> <Your Name>
   * SPDX-License-Identifier: MIT
   */
  ```

- **No comments by default.** Only write a comment when the _why_ is non-obvious (a hidden constraint, a subtle invariant, a workaround for a specific bug). Don't explain _what_ the code does — well-named identifiers do that.
- **Naming.** Tools are named for _intent_ (`capture`, `log_work`), not data shape (`log_to_section({name})`). See [#7](https://github.com/robertwtucker/para-vault-mcp/issues/7) for the design principle.
- **Strict TypeScript.** No `any`. `tsc --strict` catches things `tsx` / Vitest don't; please run `pnpm run typecheck` alongside `pnpm test`.

## Commit Style

- **Atomic commits** — one logical change per commit, even if a single PR contains several. When in doubt, smaller is better.
- **Conventional-commit-ish prefixes** matching the existing log:
  - `feat(tools):` — new tool or substantive behavior
  - `fix(...):` — bug fix
  - `refactor(...):` — internal change with no behavior delta
  - `docs(readme):` / `docs(...)` — documentation
  - `chore(build):` / `chore(tools):` — infrastructure, build, dependency, or cleanup
  - `test(...):` — tests-only changes
- **Subject line under 72 chars**, present tense, lowercase after the colon.
- **Body explains the _why_, not the _what_.** The diff shows what changed.

## What's In Scope

- Bug fixes and reliability improvements.
- Roadmap items in [open issues labeled `enhancement`](https://github.com/robertwtucker/para-vault-mcp/issues?q=is%3Aopen+label%3Aenhancement).
- New tools that have been discussed in an issue first.
- Documentation improvements that match the existing tone (engineering doc, not marketing).

## What's Out of Scope (for now)

- **Convention-specific behavior in deterministic tools.** Tools provide structured substrate; LLMs interpret convention. See #7 for the design principle.
- **Breaking changes to v0.1 tool signatures** without discussion in an issue first.
- **Speculative features** that aren't tied to a real workflow use case.

## Pull Request Process

1. Fork, branch from `main`, push to your fork.
2. Open a PR against `main`. Include:
   - What the change does (one or two sentences).
   - Why — link the issue, or explain if it's a quick fix.
   - How to verify — usually "run `pnpm test`," but mention any manual smoke steps if they apply.
3. Expect a review turnaround in days, not hours. This is a side project.
4. Squash or rebase is fine; both are acceptable.

## License

MIT. By contributing, you agree your contribution is licensed under the project's [MIT license](./LICENSE). No CLA.

## Reporting Issues

Use [GitHub Issues](https://github.com/robertwtucker/para-vault-mcp/issues). For bugs, include:

- What you expected to happen
- What actually happened (include the error message if any)
- Your environment: OS, Node version, vault structure if relevant
- Minimal repro steps

For feature requests, describe the workflow problem you're trying to solve. Proposed solutions are welcome but secondary to the underlying need.
