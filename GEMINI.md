# Brave Search MCP Server

## Project Overview

`brave-search-mcp` is a Model Context Protocol (MCP) Server that integrates with the [Brave Search API](https://brave.com/search/api/). It allows AI assistants (like Claude or Gemini) to perform web searches, image searches, news searches, video searches, and local business searches securely and efficiently.

### Key Features
*   **Web Search:** General web search functionality.
*   **Image Search:** Search for images (returns results as resources).
*   **News Search:** Find news articles and trending topics.
*   **Video Search:** Search for videos.
*   **Local Search:** Find local businesses and points of interest.

### Tech Stack
*   **Language:** TypeScript / Node.js
*   **Framework:** `@modelcontextprotocol/sdk`
*   **API Wrapper:** `brave-search`
*   **Utilities:** `axios`, `zod`
*   **Package Manager:** pnpm

## Architecture

The project follows a modular structure centered around the `BraveMcpServer` class and individual `Tool` implementations.

*   **Entry Point (`src/index.ts`):** Validates the `BRAVE_API_KEY` environment variable and starts the server (supports stdio and http modes).
*   **Server Core (`src/server.ts`):** Defines `BraveMcpServer`, which initializes the MCP server instance, registers tools, and manages resources.
*   **Tools (`src/tools/`):**
    *   `BaseTool.ts`: Abstract base class that defines the contract for all tools (name, description, schema, execution logic).
    *   Specific implementations: `BraveWebSearchTool.ts`, `BraveImageSearchTool.ts`, etc.
*   **Resources:** The server exposes image search results as MCP resources (e.g., `brave-image://...`).

## Building and Running

### Prerequisites
*   Node.js (LTS recommended)
*   pnpm
*   Brave Search API Key

### Installation
```bash
pnpm install
```

### Build
To clean and build the project:
```bash
pnpm run build
```
This compiles TypeScript files from `src/` to `dist/` and makes the output executable.

### Running
To run the server locally (requires API key):
```bash
export BRAVE_API_KEY=your_api_key_here
node dist/index.js
```
Or via the convenient script if added, otherwise directly through the built artifact.

### Development Scripts
*   `pnpm run build:watch`: Watch mode for development.
*   `pnpm run lint`: Run ESLint.
*   `pnpm run typecheck`: Run TypeScript type checking.
*   `pnpm run check`: Run both linting and type checking.
*   `pnpm run clean`: Clean the `dist` directory.

## Development Conventions

*   **Code Style:** The project uses ESLint with `@antfu/eslint-config`. ensure all code passes `pnpm run lint`.
*   **TypeScript:** Strict mode is enabled (`"strict": true` in `tsconfig.json`).
*   **Tool Implementation:** New tools should extend `BaseTool` and be registered in `BraveMcpServer.setupTools()`.
*   **Error Handling:** Tools should gracefully handle errors and return structured error responses to the MCP client.
