# Brave Search MCP Monorepo

This monorepo contains the Brave Search Model Context Protocol (MCP) server and its dependencies.

## Structure

- **`apps/brave-search-mcp`**: The MCP Server application.
- **`packages/brave-search`**: The Brave Search API SDK.

## Quick Start

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```

2.  **Build everything:**
    ```bash
    pnpm build
    ```

3.  **Run the MCP Server:**
    ```bash
    cd apps/brave-search-mcp
    export BRAVE_API_KEY=your_key
    node dist/index.js
    ```

See [GEMINI.md](./GEMINI.md) for detailed architectural documentation.
