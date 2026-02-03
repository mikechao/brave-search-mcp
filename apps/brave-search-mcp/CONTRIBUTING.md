# Contributing to Brave Search MCP Server

Thank you for your interest in contributing! This guide covers the development workflow, project structure, and release process.

## Prerequisites

- **Node.js 20+** (CI uses Node 24)
- **pnpm** - Install with `npm install -g pnpm`
- **Brave Search API Key** - [Get one here](https://api.search.brave.com/app/keys)

## Monorepo Structure

This repository is a monorepo managed with **pnpm workspaces** and **Turbo**.

```
brave-search-mcp/
├── apps/
│   └── brave-search-mcp/     # The MCP Server (published to npm)
├── packages/
│   └── brave-search/         # Shared Brave Search SDK (bundled into server)
├── turbo.json                # Turbo pipeline configuration
└── pnpm-workspace.yaml       # Workspace definitions
```

- **`apps/brave-search-mcp`** - The main MCP server application. This is the only package published to npm.
- **`packages/brave-search`** - A typed SDK/wrapper for the Brave Search API. It's bundled into the server build and not published separately.

## Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/mikechao/brave-search-mcp.git
   cd brave-search-mcp
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

   > If pnpm blocks esbuild postinstall, run `pnpm approve-builds` and allow `esbuild`.

3. **Build all packages**

   ```bash
   pnpm build
   ```

4. **Run the server locally**

   ```bash
   BRAVE_API_KEY=your_key_here node apps/brave-search-mcp/dist/index.js
   ```

   With HTTP and UI mode enabled:

   ```bash
   BRAVE_API_KEY=your_key_here node apps/brave-search-mcp/dist/index.js --http --ui
   ```

## Development Commands

Run these from the **monorepo root**:

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages and apps |
| `pnpm dev` | Run development mode |
| `pnpm lint` | Lint all packages |
| `pnpm check` | Typecheck and lint all |
| `pnpm clean` | Clean dist folders |

To run commands for a specific workspace:

```bash
pnpm -C apps/brave-search-mcp build
pnpm -C packages/brave-search build
```

## Code Style

This project uses ESLint with [`@antfu/eslint-config`](https://github.com/antfu/eslint-config). Run `pnpm lint` to check for issues.

## MCP Bundles (MCPB)

[MCP Bundles](https://github.com/modelcontextprotocol/mcpb/) allow one-click installation of local MCP Servers in Claude Desktop.

### Prerequisites

Install the MCPB CLI globally:

```bash
npm install -g @anthropic-ai/mcpb
```

### Creating a manifest.json

From the `apps/brave-search-mcp` directory:

```bash
mcpb init
```

This starts an interactive CLI to generate `manifest.json`.

### Creating the .mcpb file

1. **Install dependencies and build**

   ```bash
   pnpm install
   pnpm build
   ```

2. **Install production dependencies only** (creates a smaller bundle)

   ```bash
   pnpm install --prod
   ```

3. **Generate the bundle**

   ```bash
   mcpb pack
   ```

   This validates `manifest.json` and creates a `.mcpb` file (essentially a zip) containing the directory contents.

## Releasing the Package

Only `apps/brave-search-mcp` is published to npm. The `brave-search` SDK is bundled into the server build.

### Release Process

1. **Create a changeset**

   ```bash
   pnpm changeset
   ```

   Select `brave-search-mcp` and choose the appropriate version bump (patch/minor/major).

2. **Apply versions and sync manifest**

   ```bash
   pnpm -C apps/brave-search-mcp changeset:version
   ```

3. **Commit and push**

   ```bash
   git add .
   git commit -m "chore: version bump"
   git push
   ```

4. **Create a GitHub release/tag**

   This triggers the publish workflow in `.github/workflows/publish.yml`.

### Pre-release Verification

Before releasing, verify the build works:

```bash
BRAVE_API_KEY=your_key_here node apps/brave-search-mcp/dist/index.js --http
```

### Changeset Guidelines

- Create a changeset for any user-facing behavior changes
- Changesets are stored in `.changeset/` directory
- Include a clear description of what changed

## Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run `pnpm check` to ensure linting and types pass
5. Commit your changes
6. Push to your fork and open a Pull Request

## Questions?

Feel free to open an issue if you have questions or run into problems!
