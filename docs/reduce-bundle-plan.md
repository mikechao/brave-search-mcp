# Bundle Size Reduction Plans

Analysis of `apps/brave-search-mcp` dist directory (4.7 MB total: 608 KB server + 4.1 MB UI).

## Current State

### Server bundle (`dist/index.js` — 608 KB)

Top dependencies by input size:

| Package | Input Size | Notes |
|---------|-----------|-------|
| `@modelcontextprotocol/ext-apps` | 284 KB | Largest single dep (52% of output) |
| `@modelcontextprotocol/sdk` | 257 KB | Core MCP SDK |
| `ajv` + `ajv-formats` + `fast-uri` | 247 KB | Transitive via ext-apps |
| `hono` + `@hono/node-server` | 87 KB | HTTP framework |
| `zod-to-json-schema` | 53 KB | Transitive via MCP SDK |

### UI bundle (`dist/ui/` — 4.1 MB, gzip ~1 MB)

10 self-contained single-file HTML bundles (5 routes × 2 variants: MCP + ChatGPT).
Each file inlines all JS, CSS, and dependencies, causing heavy duplication.

| File | Size |
|------|------|
| `local/mcp-app.html` | 835 KB |
| `web/mcp-app.html` | 560 KB |
| `video/mcp-app.html` | 540 KB |
| `news/mcp-app.html` | 538 KB |
| `image/mcp-app.html` | 532 KB |
| `local/chatgpt-app.html` | 462 KB |
| `web/chatgpt-app.html` | 187 KB |
| `video/chatgpt-app.html` | 168 KB |
| `news/chatgpt-app.html` | 166 KB |
| `image/chatgpt-app.html` | 159 KB |

---

## Already Done

- [x] Enable minify in tsup.config
- [x] Exclude source maps
- [x] Reduce duplicated bundles
- [x] Switch from axios to native fetch
- [x] Switch from Express to Hono
- [x] Switch from React to Preact
- [x] Switch from react-markdown to snarkdown

---

## Ruled Out

### ~~Shared JS/CSS chunks (stop single-file inlining)~~

**Why not:** Widgets are served as HTML strings via MCP resource responses and rendered
inside iframes by the MCP host. Everything must be self-contained in a single HTML file.
There is no HTTP URL the iframe can fetch shared chunks from.

**Potential savings:** ~2–2.5 MB (would have been the highest-impact change).

### ~~Pre-compress dist HTML (gzip/brotli)~~

**Why not:** The HTML is not served over regular HTTP — it's embedded as a `text` field
inside a JSON-RPC response via the MCP Streamable HTTP transport (which uses SSE) or
stdio. There is no HTTP content negotiation layer to leverage.
Compression middleware also conflicts with SSE (buffering breaks streaming).
Storing gzipped blobs would require client-side decompression support that the MCP spec
doesn't define.

**Potential savings:** ~3 MB effective on-disk (not applicable).

### ~~Vendor/tree-shake `@modelcontextprotocol/ext-apps`~~

**Why not (for now):** The package ships a single bundled `dist/src/server/index.js`
(284 KB input) that is not tree-shakeable. Would require vendoring specific functions
(`registerAppResource`, `registerAppTool`, `RESOURCE_MIME_TYPE`) which is brittle and
high-maintenance. Wait for upstream to ship tree-shakeable ESM exports.

**Potential savings:** ~200 KB from server bundle.

---

## Actionable Plans

### Plan 1: Replace `react-markdown` with a lighter Markdown renderer (*Done*)

**Effort:** Low
**Est. savings:** ~100 KB × 2 local files (~200 KB total)

`react-markdown` pulls in `unified`, `remark-parse`, `micromark`, and the full Markdown
AST pipeline. It's used only in `LocalBusinessDescription.tsx` to render simple business
descriptions.

**Options:**
- **`snarkdown`** (~1 KB) — minimal Markdown-to-HTML, covers bold/italic/links/lists
- **`marked`** (~40 KB) — full-featured but much lighter than react-markdown
- **Manual rendering** — if descriptions only use bold/italic/links, a few regex
  replacements suffice

**Files to change:**
- `ui/src/lib/local/LocalBusinessDescription.tsx` — replace `ReactMarkdown` import

### Plan 2: Replace `DOMPurify` with a tiny custom sanitizer

**Effort:** Low
**Est. savings:** ~30 KB × 10 files (~300 KB total)

`DOMPurify` is ~60 KB unminified. The current usage in `sanitize.ts` is very restrictive:
- `sanitizeHtml()` allows only `<strong>`, `<em>`, `<b>`, `<i>`, `<u>`, `<mark>`,
  `<span>`, `<p>`, `<br>` with zero attributes
- `stripHtml()` strips all tags, keeps text content

This can be replaced with:
- A ~20-line function using the browser's built-in `DOMParser` + a tag allowlist
- Or the emerging `Sanitizer` API (not yet widely available)

**Files to change:**
- `ui/src/lib/shared/sanitize.ts` — replace DOMPurify with custom implementation

### Plan 3: Reduce Leaflet/react-leaflet footprint in local search

**Effort:** Medium
**Est. savings:** ~300 KB off 2 local files (~600 KB total)

Leaflet + react-leaflet account for the ~300 KB delta between `local/mcp-app.html`
(835 KB) and other MCP routes (~530 KB). Includes Leaflet JS, CSS, and the react-leaflet
wrapper with a Preact compatibility shim.

**Options:**
- **Load Leaflet from CDN** — add the CDN URL to the widget's CSP `resourceDomains` and
  use `<script src="...">` / `<link href="...">` instead of inlining. Requires confirming
  the MCP host's iframe allows external script loading.
- **Replace with a static map image** — use a tile server URL to render a static `<img>`
  with markers. Zero JS needed. Loses interactivity (pan/zoom).
- **Replace with a lighter map library** — e.g., `maplibre-gl` (but it's also heavy) or
  a minimal canvas-based renderer.

**Files to change:**
- `ui/src/lib/local/LocalMap.tsx` — replace Leaflet implementation
- `ui/src/shims/react-compat.js` — may no longer need `use()` shim if react-leaflet is
  removed

---

## Impact Summary

| # | Change | Est. Savings | Effort | Status |
|---|--------|-------------|--------|--------|
| 1 | Replace react-markdown | ~200 KB | Low | Planned |
| 2 | Replace DOMPurify | ~300 KB | Low | Planned |
| 3 | Reduce Leaflet footprint | ~600 KB | Medium | Planned |
| — | Shared chunks | ~2.5 MB | — | Ruled out (iframe constraint) |
| — | Pre-compress HTML | ~3 MB | — | Ruled out (MCP transport) |
| — | Tree-shake ext-apps | ~200 KB | — | Ruled out (not tree-shakeable) |

**Total actionable savings: ~1.1 MB** (from 4.7 MB → ~3.6 MB)