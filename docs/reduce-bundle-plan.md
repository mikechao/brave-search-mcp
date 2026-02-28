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
- [x] Repliace DOMPurify with custom
- [x] Replace Leaflet/react-leaflet with pigeon-maps
- [x] Remove KaTeX css
- [x] Use Terser for minification
- [x] Replace openai button with custom button

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

### Plan 2: Replace `DOMPurify` with a tiny custom sanitizer (*Done*)

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

### Plan 3: Reduce Leaflet/react-leaflet footprint in local search (*Done*)

**Effort:** Medium
**Est. savings:** ~300 KB off 2 local files (~600 KB total)
**Actual savings:** −244 KB (`local/mcp-app.html`: 835 → 591 KB) + −253 KB (`local/chatgpt-app.html`: 462 → 209 KB) = **−497 KB total**

Replaced `leaflet` + `react-leaflet` (~300 KB bundled) with
[`pigeon-maps`](https://pigeon-maps.js.org/) (~15 KB). Uses the same OpenStreetMap
tile provider. Custom markers rendered as Preact JSX children inside `<Marker>`;
popups rendered as `<Overlay>` components anchored to lat/lng. Fit-to-bounds zoom
calculated with standard OSM tile math (no external library). The `MapResizeHandler`
and `MapBoundsUpdater` Leaflet-internal helpers were deleted entirely (pigeon-maps
uses `ResizeObserver` internally). The `use()` shim in `react-compat.js` was also
removed since it existed solely for `react-leaflet@5`.

**Files changed:**
- `ui/src/lib/local/LocalMap.tsx` — replaced Leaflet with pigeon-maps
- `ui/src/shims/react-compat.js` — removed `use()` shim, now re-exports `preact/compat` only
- `ui/src/lib/local/local.css` — added `.local-map-popup--overlay` positioning rule
- `package.json` — removed `leaflet`, `react-leaflet`, `@types/leaflet`; added `pigeon-maps`

### Plan 4: Remove KaTeX CSS from `@openai/apps-sdk-ui` global import (*done*)

**Effort:** Low
**Est. savings:** ~25 KB × 10 files = ~250 KB

`global.css` imports `@openai/apps-sdk-ui/css` which resolves to
`@openai/apps-sdk-ui/dist/es/styles/index.css`. That file unconditionally
includes `katex.min.css` (25 KB, already minified):

```css
@import "./katex.min.css" layer(base);
```

KaTeX is for rendering mathematical notation — none of the search widgets
display math. This 25 KB is inlined into every HTML file for free.

**Fix:** Replace the monolithic `@import '@openai/apps-sdk-ui/css'` in
`global.css` with selective imports of only the needed CSS variable sheets,
skipping `katex.min.css` and `tailwind-utilities.css`:

```css
/* Instead of: @import '@openai/apps-sdk-ui/css'; */
@import '@openai/apps-sdk-ui/dist/es/styles/base.css';
@import '@openai/apps-sdk-ui/dist/es/styles/variables-primitive.css';
@import '@openai/apps-sdk-ui/dist/es/styles/variables-semantic.css';
@import '@openai/apps-sdk-ui/dist/es/styles/variables-components.css';
@import '@openai/apps-sdk-ui/dist/es/styles/globals.css';
```

Also remove `@source "../../node_modules/@openai/apps-sdk-ui"` from the
Tailwind config — the SDK's components use CSS modules, not utility classes
generated by the project's Tailwind build, so scanning the SDK source adds
unused utilities to every file.

**Files to change:**
- `ui/src/global.css` — replace monolithic import with selective imports;
  remove `@source` directive for the SDK

### Plan 5: Replace `@openai/apps-sdk-ui/components/Button` with an inline component (*done*)

**Effort:** Medium
**Est. savings:** ~60 KB × 10 files = ~600 KB

The `Button` component used for pagination in `SearchAppLayout` drags in a
large cascade of dependencies:

| File | Size |
|------|------|
| `Button.module.css` | 32.9 KB |
| `AnimateLayout.js` | 10.5 KB |
| `TransitionGroup.js` | 9.5 KB |
| `helpers.js` | 5.0 KB |
| `AnimateLayout.module.css` | 3.6 KB |
| `AppsSDKUIProvider` context | ~2 KB |

The pagination use-case is two `<button>` elements with arrow icons and a
loading state. A small inline Preact `PaginationButton` component using
Tailwind utility classes would cover the same UI with no CSS modules or
animation infrastructure.

`LoadingIndicator` is also imported directly in `SearchAppLayout` and by
`Button` internally. A simple CSS spinner (`@keyframes spin` + `border`)
inlined as a Tailwind component would replace it at near-zero cost.

**Files to change:**
- `ui/src/lib/shared/SearchAppLayout.tsx` — replace `<Button>` with inline
  `<button>` or a tiny local component; replace `<LoadingIndicator>` with a
  CSS spinner
- Create `ui/src/lib/shared/PaginationButton.tsx` (optional thin wrapper)

### Plan 6: Vendor `App` + `PostMessageTransport` from `@modelcontextprotocol/ext-apps` (UI only)

**Effort:** High
**Est. savings:** ~370 KB × 5 MCP UI files = ~1.85 MB

`@modelcontextprotocol/ext-apps` is shipped as a single non-tree-shakeable
284 KB bundle. The server ruling (see Ruled Out above) applies to
`registerAppResource`, `registerAppTool`, and `RESOURCE_MIME_TYPE` — complex
infrastructure that's hard to vendor safely.

The UI side is different: `useMcpApp.ts` only imports two things:
- `App` — the client-side widget ↔ host communication class
- `PostMessageTransport` — the postMessage channel implementation

If these two classes could be extracted (vendored) into the repo, every one of
the 5 MCP HTML files would shrink by ~370 KB. The upstream package is open
source so this is feasible, but must be re-synced on every ext-apps release.

**Viable approach:** Copy just `App` + `PostMessageTransport` source into
`ui/src/vendor/mcp-app/` and import from there instead of the npm package.
Run a CI script to check if the upstream version has advanced and alert.

**Files to change:**
- `ui/src/vendor/mcp-app/` — vendored App + PostMessageTransport
- `ui/src/hooks/useMcpApp.ts` — update import path
- `package.json` — `@modelcontextprotocol/ext-apps` can be kept as a dev-only
  dep (it still must be installed for the server)

### Plan 7: Switch server bundle to Terser minification (*done*)

**Effort:** Very low
**Est. savings:** ~30–60 KB (5–10% of 606 KB server bundle)

tsup currently uses esbuild for minification (fast but conservative). Terser
applies more aggressive transforms: constant folding across passes, top-level
symbol mangling, dead-code pruning, and better identifier shortening.

```ts
// tsup.config.ts
minify: 'terser',
terserOptions: {
  compress: { passes: 2 },
  mangle: { toplevel: true },
},
```

**Trade-off:** Build time increases (~5–15 s extra). Output is not runtime-affected
since the server runs in Node.

**Files to change:**
- `apps/brave-search-mcp/tsup.config.ts`

---

## Impact Summary

| # | Change | Est. Savings | Effort | Status |
|---|--------|-------------|--------|--------|
| 1 | Replace react-markdown | ~200 KB | Low | Done |
| 2 | Replace DOMPurify | ~300 KB | Low | Done |
| 3 | Reduce Leaflet footprint | ~497 KB (actual) | Medium | Done |
| 4 | Remove KaTeX CSS + SDK Tailwind source scan | ~250 KB | Low | Planned |
| 5 | Replace Button + LoadingIndicator | ~600 KB | Medium | Planned |
| 6 | Vendor App + PostMessageTransport (UI) | ~1.85 MB | High | Planned |
| 7 | Terser for server bundle | ~30–60 KB | Very low | Planned |
| — | Shared chunks | ~2.5 MB | — | Ruled out (iframe constraint) |
| — | Pre-compress HTML | ~3 MB | — | Ruled out (MCP transport) |
| — | Tree-shake ext-apps (server) | ~200 KB | — | Ruled out (not tree-shakeable) |

**Total actionable savings remaining: ~2.73–2.76 MB** (plans 4–7)