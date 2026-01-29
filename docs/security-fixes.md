## lodash@4.17,23 installed to fix
https://github.com/mikechao/brave-search-mcp/security/dependabot/25

it's a transitive dependencies from @openai/apps-sdk-ui@0.2.1
 The fix is the pnpm override in root package.json
   "pnpm": {
    "overrides": {
      "lodash": "^4.17.23"
    }
  }