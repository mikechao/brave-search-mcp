## hono 4.11.4 to fix security issues. 
https://github.com/mikechao/brave-search-mcp/security/dependabot/21
https://github.com/mikechao/brave-search-mcp/security/dependabot/22

The chain 
  - @modelcontextprotocol/ext-apps → @modelcontextprotocol/sdk
  - @modelcontextprotocol/sdk → @hono/node-server
  - @hono/node-server has a peer on hono, which resolves to 4.11.3 in your lockfile.

The fix
 added "hono": "4.11.4" to apps/brave-search-mcp/package.json