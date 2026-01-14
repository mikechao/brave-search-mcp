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

## Dual-Host Widget Pattern (MCP-APP + ChatGPT)

When creating UI widgets for MCP tools, use the **Dual-Resource Strategy** to support both MCP-APP hosts (Claude Desktop, MCPJam) and ChatGPT from a single server instance.

### Key Points

1. **Separate bundles required** - `vite-plugin-singlefile` bundles everything, so ext-apps SDK initialization runs even with `React.lazy()`. Create two entry points:
   - `mcp-app.html` - includes ext-apps SDK for MCP-APP hosts
   - `chatgpt-app.html` - standalone, no ext-apps imports (uses `window.openai`)

2. **Register both resources** with combined metadata:
```typescript
registerAppTool(server, toolName, {
  _meta: {
    // MCP-APP (ext-apps) looks for this
    ui: { resourceUri: 'ui://tool/mcp-app.html' },
    // ChatGPT looks for this
    'openai/outputTemplate': 'ui://tool/chatgpt-widget.html',
  },
}, handler);
```

3. **MIME types**:
   - MCP-APP: `text/html+mcpappoutput` (via `RESOURCE_MIME_TYPE`)
   - ChatGPT: `text/html+skybridge`

4. **ChatGPT widget specifics**:
   - Data: Poll `window.openai.toolOutput` (null at mount, populated later)
   - Links: Use `openExternal({ href: url })` not `openExternal(url)`
   - Types: Create `openai.d.ts` for `window.openai` API

5. **Build scripts** in `package.json`:
```json
"build:ui": "INPUT=mcp-app.html vite build --config ui/vite.config.ts",
"build:ui:chatgpt": "INPUT=chatgpt-app.html vite build --config ui/vite.config.ts"
```

### Usage
```bash
node dist/index.js --ui --http
```
Single flag serves both hosts - each picks the resource matching its capabilities.

## Conventions
*   **Workspaces:** Internal dependencies are referenced via `workspace:*` (e.g., `"brave-search": "workspace:*"`).
*   **Code Style:** ESLint with `@antfu/eslint-config`.
*   **TypeScript:** Strict mode enabled.