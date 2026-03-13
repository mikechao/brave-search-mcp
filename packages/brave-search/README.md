# brave-search

Internal workspace SDK for Brave Search API access used by the MCP server in this monorepo.

## Ownership

`packages/brave-search` owns:

- the typed `BraveSearch` client
- Brave Search request/response types
- polling logic for summarized search responses

The supported package entrypoint is `src/index.ts`, which builds to `dist/index.js` and `dist/index.d.ts`.

## Local Development

Run these commands from the repository root:

```sh
pnpm -C packages/brave-search run build
pnpm -C packages/brave-search run check
pnpm -C packages/brave-search run dev
```

## Notes

- This package is an internal workspace dependency, not a separately published npm or JSR package.
- The `version` field in `package.json` is still used by the app package publish helper.
