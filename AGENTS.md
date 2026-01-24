# Repository Guidelines

## Project Structure & Module Organization
- `apps/brave-search-mcp/` hosts the MCP server package. Server entry points live in `src/`, with tool implementations in `src/tools/`. UI assets and build inputs live under `ui/`, and build output goes to `dist/`.
- `packages/brave-search/` is the shared Brave Search SDK (typed API wrapper) with `src/` sources and `dist/` output.
- `docs/` and `scripts/` contain repo documentation and utility scripts.
- Monorepo wiring lives in `pnpm-workspace.yaml` and `turbo.json`.

## Build, Test, and Development Commands
Run commands from the repo root unless noted.
- `pnpm install` installs workspace dependencies.
- `pnpm run dev` runs package dev tasks via Turbo.
- `pnpm run build` builds all packages via Turbo.
- `pnpm run lint` runs ESLint with auto-fix.
- `pnpm run check` runs lint (no fix) and TypeScript checks.
- `pnpm run clean` removes build outputs.
- `pnpm -C apps/brave-search-mcp build` builds only the MCP server package.
- `BRAVE_API_KEY=... npx -y brave-search-mcp --http` runs the server locally in HTTP mode.

## Coding Style & Naming Conventions
- TypeScript + ESM across packages.
- ESLint uses `@antfu/eslint-config` with 2-space indentation, semicolons, and single quotes.
- Match existing naming patterns in each folder (e.g., PascalCase tool classes under `src/tools/`).

## Testing Guidelines
- No dedicated test runner is configured in this repo today.
- Use `pnpm run check` before opening a PR; add tests alongside new features if you introduce a framework.

## Commit & Pull Request Guidelines
- Recent commits use short, imperative, sentence-case summaries (e.g., “Fix query spacing”).
- Keep commits focused; prefer one logical change per commit.
- PRs should include: a clear description, rationale, and any manual test notes (commands or steps).
- If user-facing behavior changes, add a Changeset before release (`pnpm changeset`).

## Configuration & Security Notes
- The server requires `BRAVE_API_KEY` at runtime; avoid committing real keys.
- Default HTTP mode runs on port 3001; override with `PORT` when needed.
