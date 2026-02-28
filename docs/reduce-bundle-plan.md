# Bundle Size Reduction Plans

Analysis of `apps/brave-search-mcp` dist directory (4.7 MB total: 608 KB server + 4.1 MB UI).

## Original State (baseline before any plans)

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

## Current State (after plans 1–5, 7)

### Server bundle (`dist/index.js` — 560 KB)

Notes: the build report shows 1.01 MB because tsup's esbuild metafile records
pre-Terser input sizes; the actual minified output on disk is 560 KB.

| Package | Notes |
|---------|-------|
| `@modelcontextprotocol/ext-apps` | ~38% of output, single non-tree-shakeable blob |
| `@modelcontextprotocol/sdk` | Core dependency, includes `experimental/tasks` via static import in `server/mcp.js` |
| `ajv` + `ajv-formats` + `fast-uri` | Transitive via ext-apps, unavoidable |
| `hono` + `@hono/node-server` | HTTP framework, minimal |

### UI bundle (`dist/ui/` — 2.89 MB, gzip ~716 KB)

| File | Size |
|------|------|
| `local/mcp-app.html` | 522 KB |
| `video/mcp-app.html` | 474 KB |
| `web/mcp-app.html` | 473 KB |
| `news/mcp-app.html` | 472 KB |
| `image/mcp-app.html` | 466 KB |
| `local/chatgpt-app.html` | 151 KB |
| `video/chatgpt-app.html` | 103 KB |
| `web/chatgpt-app.html` | 102 KB |
| `news/chatgpt-app.html` | 101 KB |
| `image/chatgpt-app.html` | 94 KB |

The ~370 KB delta between MCP and ChatGPT variants on every route is entirely
`@modelcontextprotocol/ext-apps` (unavoidable without vendoring).

Remaining base cost per ChatGPT file (~94 KB) breaks down roughly as:
- Preact runtime: ~15–20 KB
- `@openai/apps-sdk-ui` CSS variable sheets imported via `global.css`: ~56 KB raw
  (5 files: `base`, `variables-primitive`, `variables-semantic`, `variables-components`, `globals`)
- Tailwind-generated utility CSS + route-specific CSS: ~5–10 KB
- Component + hook code: ~10–15 KB

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

### ~~Vendor `App` + `PostMessageTransport` for UI (was Plan 6)~~

**Why not:** Would require re-syncing with every `@modelcontextprotocol/ext-apps` release
and maintaining a vendored copy of SDK internals. Not worth the maintenance burden.

**Potential savings:** ~370 KB × 5 MCP files ≈ 1.85 MB.

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

### Plan 8: Prune `@openai/apps-sdk-ui` CSS variable sheets

**Effort:** Medium
**Est. savings:** ~30–40 KB × 10 files = ~300–400 KB

After plans 4 and 5, all `@openai/apps-sdk-ui` JS imports have been eliminated.
The only remaining cost from the package is 5 CSS variable sheet imports in
`global.css`, totalling **56 KB raw** per HTML file:

| File | Size |
|------|------|
| `variables-semantic.css` | 31 KB |
| `variables-primitive.css` | 11.3 KB |
| `variables-components.css` | 10.6 KB |
| `base.css` | 2.2 KB |
| `globals.css` | 1 KB |

These files define CSS custom properties (`--color-background-primary-solid`,
`--color-text-*`, etc.) used as design tokens. The widgets reference only
**57 unique CSS custom properties** across all UI source, but the sheets define
hundreds of tokens (each duplicated for `:root` and `[data-theme="dark"]`).

Cannot be tree-shaken by Tailwind or any standard CSS tool — CSS custom property
definitions are always preserved.

**Approach:** Create `ui/src/styles/openai-tokens.css` containing only the
custom properties actually referenced in source (audit via grep + a one-time
extraction script). Replace the 5 `@import` lines in `global.css` with the
single pruned file. Add a CI check that re-runs the extraction on every
`@openai/apps-sdk-ui` version bump.

**Files to change:**
- `ui/src/global.css` — replace 5 @openai CSS imports with single pruned file
- `ui/src/styles/openai-tokens.css` — new vendored/pruned CSS variable file

### Plan 9: Remove unused `tailwindcss-animate` dependency (*done*)

**Effort:** Trivial
**Est. savings:** 0 KB (no bundle impact — it's never imported)

`tailwindcss-animate` is listed in `dependencies` but is not imported anywhere —
not in CSS files, not in `global.css`, not in any TS/TSX file. It's a Tailwind
plugin that generates `animate-*` utility classes, but since it's never
configured as a plugin, no classes are generated and nothing is emitted to the
bundle. Safe to remove.

**Files to change:**
- `apps/brave-search-mcp/package.json` — remove `tailwindcss-animate` from dependencies

---

## Upstream: MCP SDK `experimental/tasks` static import

The MCP SDK's `server/mcp.js` does a **static import** of
`../experimental/tasks/mcp-server.js` even when the app never uses the
`experimental` feature. This pulls ~7.7 KB of input into the server bundle.

Not actionable in this repo, but worth filing an upstream issue with
`@modelcontextprotocol/sdk` to make the experimental tasks import lazy or
tree-shakeable.

---

## Impact Summary

| # | Change | Est. Savings | Effort | Status |
|---|--------|-------------|--------|--------|
| 1 | Replace react-markdown | ~200 KB | Low | Done |
| 2 | Replace DOMPurify | ~300 KB | Low | Done |
| 3 | Reduce Leaflet footprint | ~497 KB (actual) | Medium | Done |
| 4 | Remove KaTeX CSS + SDK Tailwind source scan | ~250 KB | Low | Done |
| 5 | Replace Button + LoadingIndicator | ~600 KB | Medium | Done |
| 7 | Terser for server bundle | ~46 KB (actual) | Very low | Done |
| 8 | Prune @openai CSS variable sheets | ~300–400 KB | Medium | Planned |
| 9 | Remove tailwindcss-animate dep | 0 KB | Trivial | Planned |
| — | Shared chunks | ~2.5 MB | — | Ruled out (iframe constraint) |
| — | Pre-compress HTML | ~3 MB | — | Ruled out (MCP transport) |
| — | Tree-shake ext-apps (server) | ~200 KB | — | Ruled out (not tree-shakeable) |
| — | Vendor App + PostMessageTransport (UI) | ~1.85 MB | — | Ruled out (maintenance burden) |

**Net reduction achieved: ~1.69 MB** (4.7 MB → 3.01 MB: 560 KB server + 2.89 MB UI — before plan 8)

**Remaining actionable: ~300–400 KB** (plan 8 only — everything else is at the practical floor)