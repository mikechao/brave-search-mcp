# Brave Search MCP Monorepo

## Project Overview

This project is a monorepo containing the **Brave Search MCP Server** and its underlying dependencies. It is managed using **Turbo** and **pnpm workspaces**.

The primary goal is to provide a Model Context Protocol (MCP) Server that integrates with the [Brave Search API](https://brave.com/search/api/) for AI assistants.

## Structure

*   **`apps/brave-search-mcp`**: The MCP Server application.
    *   Exposes tools for Web, Image, News, Video, and Local search.
    *   Consumes the `brave-search` package.
*   **`packages/brave-search`**: A typed SDK/wrapper for the Brave Search API.
    *   Standalone library used by the MCP server.

## Tech Stack

*   **Monorepo Tools:** Turbo, pnpm workspaces
*   **Language:** TypeScript / Node.js
*   **Frameworks:** `@modelcontextprotocol/sdk`
*   **Utilities:** `axios`, `zod`

## Building and Running

### Prerequisites
*   Node.js (LTS)
*   pnpm (`npm install -g pnpm`)
*   Brave Search API Key

### Installation
From the root:
```bash
pnpm install
```

### Build (All)
Build all apps and packages using Turbo:
```bash
pnpm build
```

### Development
You can run tasks from the root, which will propagate to the workspaces via Turbo.

*   `pnpm build`: Build all packages/apps.
*   `pnpm lint`: Lint all packages/apps.
*   `pnpm check`: Typecheck and lint all.
*   `pnpm run clean`: Clean dist folders.

### Running the MCP Server
To run the server locally:

```bash
cd apps/brave-search-mcp
export BRAVE_API_KEY=your_api_key_here
node dist/index.js
```

## Architecture Details

### `apps/brave-search-mcp`
*   **Entry Point:** `src/index.ts`
*   **Core:** `src/server.ts` (BraveMcpServer)
*   **Tools:** `src/tools/*.ts` (BaseTool implementation)

### `packages/brave-search`
*   **Entry Point:** `src/braveSearch.ts`
*   **Types:** `src/types.ts`

## Conventions
*   **Workspaces:** Internal dependencies are referenced via `workspace:*` (e.g., `"brave-search": "workspace:*"`).
*   **Code Style:** ESLint with `@antfu/eslint-config`.
*   **TypeScript:** Strict mode enabled.