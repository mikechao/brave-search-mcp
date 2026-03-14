# Repository Guidelines

## Project Structure & Module Organization

- `src/` contains the TypeScript source. Entry points live in `src/index.ts` and `src/server.ts`.
- `src/tools/` holds tool implementations such as `BraveWebSearchTool.ts` and related search types.
- `dist/` is generated output from the TypeScript build (do not edit by hand).
- `scripts/` contains maintenance helpers (e.g., `scripts/sync-manifest-version.js`).
- `manifest.json`, `smithery.yaml`, and `Dockerfile` define packaging and distribution metadata.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies.
- `pnpm run build`: clean and compile TypeScript into `dist/`.
- `pnpm run build:watch`: watch mode compile for local development.
- `pnpm run lint`: lint and auto-fix with ESLint.
- `pnpm run lint:check`: lint without auto-fix (CI-friendly).
- `pnpm run typecheck`: TypeScript type checking only.
- `pnpm run check`: run lint check + typecheck + manifest tool drift validation.
- `pnpm run test`: run the default unit + integration Vitest suite.
- `pnpm run test:unit`: run the unit suite with SDK and UI build preparation.
- `pnpm run test:integration`: run the integration suite with SDK, built server, and mocked test server preparation.
- `pnpm run changeset:version`: apply changesets and sync `manifest.json` version.

## Coding Style & Naming Conventions

- TypeScript, ES modules (`"type": "module"`).
- ESLint uses the Antfu config with explicit style rules: 2-space indentation, single quotes, semicolons.
- Prefer descriptive tool names aligned with Brave features (e.g., `BraveNewsSearchTool`).

## Testing Guidelines

- This workspace uses Vitest for unit, integration, and eval coverage.
- Keep new logic small and verifiable; run `pnpm run check` and `pnpm run test` before opening a PR.

## Commit & Pull Request Guidelines

- Recent commits use short, imperative, sentence-case messages (e.g., “Switch to pnpm”). Follow that style.
- PRs should include a clear description, any relevant issue links, and note API or behavior changes.
- If user-facing behavior changes, add a changeset under `.changeset/`.

## Security & Configuration Notes

- The server requires `BRAVE_API_KEY` in the environment when running locally or in Docker.
- Avoid committing secrets or local `.vscode` configs; use environment variables instead.
