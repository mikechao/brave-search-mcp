# Brave Search MCP Server

An MCP Server implementation that integrates the [Brave Search API](https://brave.com/search/api/), providing, Web Search, Local Points of Interest Search, Video Search, Image Search and News Search capabilities

<a href="https://glama.ai/mcp/servers/@mikechao/brave-search-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@mikechao/brave-search-mcp/badge" alt="Brave Search MCP server" />
</a>

## Features

- **Web Search**: Perform a regular search on the web
- **Image Search**: Search the web for images.
- **News Search**: Search the web for news
- **Video Search**: Search the web for videos
- **Local Points of Interest Search**: Search for local physical locations, businesses, restaurants, services, etc

## Tools

- **brave_web_search**
  - Execute web searches using Brave's API
  - Inputs:
    - `query` (string): The term to search the internet for
    - `count` (number, optional): The number of results to return (max 20, default 10)
    - `offset` (number, optional, default 0): The offset for pagination
    - `freshness` (enum, optional): Filters search results by when they were discovered
      - The following values are supported
        - pd: Discovered within the last 24 hours.
        - pw: Discovered within the last 7 Days.
        - pm: Discovered within the last 31 Days.
        - py: Discovered within the last 365 Days
        - YYYY-MM-DDtoYYYY-MM-DD: Custom date range (e.g., 2022-04-01to2022-07-30)

- **brave_image_search**
  - Get images from the web relevant to the query
  - Inputs:
    - `query` (string): The term to search the internet for images of
    - `count` (number, optional): The number of images to return (max 50, default 10)

- **brave_news_search**
  - Searches the web for news
  - Inputs:
    - `query` (string): The term to search the internet for news articles, trending topics, or recent events
    - `count` (number, optional): The number of results to return (max 20, default 10)
    - `offset` (number, optional, default 0): The zero-based offset for pagination (max 9)
    - `freshness` (enum, optional): Filters search results by when they were discovered
      - The following values are supported
        - pd: Discovered within the last 24 hours.
        - pw: Discovered within the last 7 Days.
        - pm: Discovered within the last 31 Days.
        - py: Discovered within the last 365 Days
        - YYYY-MM-DDtoYYYY-MM-DD: Custom date range (e.g., 2022-04-01to2022-07-30)

- **brave_local_search**
  - Search for local businesses, services and points of interest
  - **REQUIRES** subscription to the Pro api plan for location results
  - Falls back to brave_web_search if no location results are found
  - Inputs:
    - `query` (string): Local search term
    - `count` (number, optional): The number of results to return (max 20, default 5)

- **brave_video_search**
  - Search the web for videos
  - Inputs:
    - `query`: (string): The term to search for videos
    - `count`: (number, optional): The number of videos to return (max 20, default 10)
    - `offset` (number, optional, default 0): The zero-based offset for pagination (max 9)
    - `freshness` (enum, optional): Filters search results by when they were discovered
      - The following values are supported
        - pd: Discovered within the last 24 hours.
        - pw: Discovered within the last 7 Days.
        - pm: Discovered within the last 31 Days.
        - py: Discovered within the last 365 Days
        - YYYY-MM-DDtoYYYY-MM-DD: Custom date range (e.g., 2022-04-01to2022-07-30)

## Configuration

### Getting an API Key

1. Sign up for a [Brave Search API account](https://brave.com/search/api/)
2. Choose a plan (Free tier available with 2,000 queries/month)
3. Generate your API key [from the developer dashboard](https://api.search.brave.com/app/keys)

### Streamable HTTP mode

By default the MCP server runs in stdio mode.

```bash
BRAVE_API_KEY="your_key_here" npx -y brave-search-mcp
```

To enable Streamable HTTP mode:

```bash
BRAVE_API_KEY="your_key_here" npx -y brave-search-mcp --http
```

By default the server listens on port 3001.
The URL is:

```
http://localhost:3001/mcp
```

The port can be configured via the PORT environment variable. For example:

```bash
PORT=4000 BRAVE_API_KEY="your_key_here" npx -y brave-search-mcp --http
```

### Usage with ChatGPT

The Brave Search MCP Server can be used with the web UI of ChatGPT. It takes a few steps.

#### 1. Enable Developer Mode in ChatGPT

Settings → Apps → Advanced settings → Developer mode

Additional instructions [here](https://platform.openai.com/docs/guides/developer-mode)

#### 2. Run the Brave Search MCP in HTTP mode

```bash
BRAVE_API_KEY="your_key_here" npx -y brave-search-mcp --http
```

#### 3. Create a local tunnel to expose the MCP Server to ChatGPT

Sign up and configure [ngrok](https://ngrok.com/), the free plan works.

```bash
ngrok http 3001
```

Take note of the forwarding URL.

```bash
...
Forwarding                    https://john-joe-asdf.ngrok-free.dev -> http://localhost:3001
...
```

#### 4. Add Brave Search MCP as a Connector to ChatGPT

Open [ChatGPT Apps settings](https://chatgpt.com/#settings/Connectors)

Click Apps

Click Create Apps

Fill out the form using the URL from step 3 as the MCP Server URL, but add `/mcp`.

```
https://john-joe-asdf.ngrok-free.dev/mcp
```

For Authentication, select 'No Auth'

Tick the checkbox for 'I understand and want to continue'

Then click Create.

#### 5. Using the Brave Search MCP Server

In the ChatGPT UI, click the '+' button, scroll to '...more', select the newly created Brave Search app, and enter your query.

### Usage with Claude Code

For [Claude Code](https://claude.ai/code) users, run this command:

**Windows:**

```bash
claude mcp add-json brave-search '{"command":"cmd","args":["/c","npx","-y","brave-search-mcp"],"env":{"BRAVE_API_KEY":"YOUR_API_KEY_HERE"}}'
```

**Linux/macOS:**

```bash
claude mcp add-json brave-search '{"command":"npx","args":["-y","brave-search-mcp"],"env":{"BRAVE_API_KEY":"YOUR_API_KEY_HERE"}}'
```

Replace `YOUR_API_KEY_HERE` with your actual Brave Search API key.

### Usage with Claude Desktop

#### MCP Bundle (MCPB)

1. Download the `mcpb` file from the [Releases](https://github.com/mikechao/brave-search-mcp/releases)
2. Open it with Claude Desktop
   or
   Go to File -> Settings -> Extensions and drag the .mcpb file to the window to install it

#### Docker

1. Clone the repo
2. Docker build

```bash
docker build -t brave-search-mcp:latest -f ./Dockerfile .
```

3. Add this to your `claude_desktop_config.json`:

```json
{
  "mcp-servers": {
    "brave-search": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "BRAVE_API_KEY",
        "brave-search-mcp"
      ],
      "env": {
        "BRAVE_API_KEY": "YOUR API KEY HERE"
      }
    }
  }
}
```

#### NPX

Add this to your `claude_desktop_config.json`:

```json
{
  "mcp-servers": {
    "brave-search": {
      "command": "npx",
      "args": [
        "-y",
        "brave-search-mcp"
      ],
      "env": {
        "BRAVE_API_KEY": "YOUR API KEY HERE"
      }
    }
  }
}
```

### Usage with LibreChat

Add this to librechat.yaml

```yaml
brave-search:
  command: sh
  args:
    - -c
    - BRAVE_API_KEY=API KEY npx -y brave-search-mcp
```

## Monorepo Structure

This repository is a monorepo. The MCP server lives in `apps/brave-search-mcp`, and the shared Brave Search SDK lives in `packages/brave-search`. Most development and release work happens from the repo root using `pnpm` and `turbo`.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## MCP Bundles (MCPB)

Anthropic recently released [MCP Bundles](https://github.com/modelcontextprotocol/mcpb/) allowing installation of local MCP Servers with one click.

Install the CLI tool to help generate both `manifest.json` and final `.mcpb` file.

```sh
npm install -g @anthropic-ai/mcpb
```

### Creating the manifest.json file

1. In this folder/directory which contains the local MCP Server, run `mcpb init`. The command will start an interactive CLI to help create the `manifest.json`.

### Creating the `mcpb` file

1. First install dev dependencies and build

```sh
pnpm install
pnpm run build
```

2. Then install only the production dependencies, generate a smaller nodule_modules directory

```sh
pnpm install --prod
```

3. Run `mcpb pack` to create a `mcpb` file. This will also validate the manifest.json that was created. The `mcpb` is essentially a zip file and will contain everything in this directory.

## Releasing the package

- The `brave-search` SDK is bundled into the server build; only `apps/brave-search-mcp` is published to npm.
- Requires Node 20+ (see the `engines` field in `apps/brave-search-mcp/package.json`). CI uses Node 24.
- Build with `pnpm -C apps/brave-search-mcp build` (or `pnpm -C apps/brave-search-mcp build:all`).
  - If pnpm blocks esbuild postinstall, run `pnpm approve-builds` and allow `esbuild`.
- To release (e.g. 1.0.1):
  1. Run `pnpm changeset` and select `brave-search-mcp` with a patch bump.
  2. Apply versions + sync manifest with `pnpm -C apps/brave-search-mcp changeset:version`.
  3. Commit and push the version changes.
  4. Create a GitHub release/tag (this triggers the publish workflow).
- If user-facing behavior changes, create a changeset in `.changeset/` before releasing.
- Verify locally with `BRAVE_API_KEY=... node dist/index.js --http`.

## Disclaimer

This library is not officially associated with Brave Software. It is a third-party implementation of the Brave Search API with a MCP Server.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
