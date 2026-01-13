# Brave Image Search UI Plan

## Goal
Add a React-based MCP UI for `brave_image_search` that is **only enabled when `--ui` is passed**. The UI should render image search results using `structuredContent` and provide a polished, clickable gallery.


## Reference
Model the structure on `_reference/ext-apps/examples/threejs-server`:
- React UI bundled into a single HTML file.
- `registerAppTool` + `registerAppResource`.
- `ui://` resource URI used to link tool output to UI.

## High-Level Approach
1. **UI bundle**: Create a small React app that renders results and build it into a single HTML file.
2. **Tool output**: Update `BraveImageSearchTool` to return `structuredContent` with a stable schema.
3. **Conditional registration**: Register UI resources/tools only when `--ui` is passed.
4. **Build wiring**: Add a `build:ui` script and integrate into `pnpm run build`.

## File Layout (proposed)
- `apps/brave-search-mcp/ui/`
  - `mcp-app.html` (entry HTML for Vite)
  - `src/`
    - `mcp-app-wrapper.tsx` (hooks into MCP app APIs)
    - `image-search-app.tsx` (UI component)
    - `global.css`
  - `vite.config.ts`
  - `tsconfig.json`
- Output: `apps/brave-search-mcp/dist/ui/mcp-app.html`

## Tool Output Schema
When `--ui` is passed, `BraveImageSearchTool` should return:
```ts
{
  searchTerm: string,
  count: number,
  items: Array<{
    title: string,
    pageUrl: string,
    imageUrl: string,
    source: string,
    confidence?: string,
    width?: number,
    height?: number,
  }>
  error?: string
}
```
- Keep the existing text response as-is (always).
- Include `structuredContent` only when `--ui` is passed.
- Output field names mirror tool input names (`searchTerm`, `count`) to avoid UI/tool mismatches.
- On empty or error cases in UI mode, still return `structuredContent` with `items: []`, `count: 0`, and `error` populated for errors.
## UI Data Wiring (required)
- The UI should render from `toolResult.structuredContent`, not from `toolInputs`.
- Ensure the wrapper listens to `app.ontoolresult` and passes `toolResult` into the component.
- `image-search-app.tsx` should read `const data = toolResult?.structuredContent` and handle:
  - Missing `structuredContent` (show a helpful empty/error state).
  - `error` field (display an error message).
  - `items` for the grid gallery.

## Server Registration (UI Only)
When `--ui` is passed:
- Define `resourceUri = "ui://brave-image-search/mcp-app.html"`.
- Use `registerAppTool` for `brave_image_search` and include:
  - `inputSchema` and `outputSchema`
  - `_meta: { ui: { resourceUri } }`
- Use `registerAppResource` to serve the built HTML:
  - Read from `dist/ui/mcp-app.html`.
  - Use `RESOURCE_MIME_TYPE`.
- Consider a guard if `dist/ui/mcp-app.html` is missing:
  - Return a clear error (or skip UI registration) to avoid hard failure.
- Otherwise, keep the existing `registerTool` behavior (no UI).

## Build Integration
- Add `build:ui` script to `apps/brave-search-mcp/package.json` (Vite single-file build).
- Mirror the reference Vite config expectations:
  - Set `INPUT` env var to the UI entry HTML (e.g. `apps/brave-search-mcp/ui/mcp-app.html`).
  - Configure `rollupOptions.input = INPUT` and `outDir = "dist/ui"` so the output is `dist/ui/mcp-app.html`.
- Add UI build deps to `apps/brave-search-mcp/package.json`:
  - `vite`, `@vitejs/plugin-react`, `vite-plugin-singlefile`
  - (Optional) `@types/react`, `@types/react-dom` if TS complains in `ui/`.
- Update `build` to run `build:ui` after `tsup`.
- Set `emptyOutDir: false` in the UI `vite.config.ts` so Vite doesn't wipe `dist` (tsup output).
- Ensure `dist/ui` is produced as part of normal builds.
- Decide whether to include UI typechecking:
  - Option A: Add `typecheck:ui` (separate tsconfig under `ui/`).
  - Option B: Leave UI out of `pnpm run typecheck` (current `tsconfig.json` only includes `src/**/*`).

## UI Behavior (MVP)
- Render a masonry or grid layout of thumbnails.
- Show title, source, and dimensions on hover or in a small caption.
- Clicking an image opens the source page via `openLink`.
- Handle empty results and error states gracefully (show error message when provided).

## Visual Direction (Selected)
- **Modernist Grid / Swiss**
  - Typography: Space Grotesk (primary), fallback to system sans.
  - Color: off‑white (#FAFAF7), near‑black (#111), electric blue accent (#1F4FFF).
  - Layout: strict grid with generous gutters and baseline-aligned metadata.
  - Motion: subtle scale/opacity on hover; staggered reveal on load.

## Open Questions / Decisions
- Results should be rendered from tool output only (no in-UI re-search).
- Any additional actions (copy URL, download, etc.)?
