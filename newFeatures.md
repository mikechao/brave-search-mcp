# New Features

## Query Policy Layer

Operators can now configure a policy file that the MCP server reads at startup. Any search query — or URL input on the LLM-context tool — that matches a forbidden phrase or regular-expression pattern is rejected before it ever reaches the Brave Search API. The server returns a structured error to the caller explaining that the request was denied.

### What it does

- **Hard-block mode (default):** A matching query is rejected immediately. The caller receives an `isError: true` result whose text begins with `[POLICY:DENIED]`. No outbound Brave API request is made.
- **Redaction mode (opt-in):** Matched text inside `query` or `url` is replaced with the literal string `[REDACTED]` and the (sanitized) request is allowed through. The caller receives normal search results; the original text never leaves the server.

Only free-text inputs are inspected: `query` on every tool, and `url` on the `brave_llm_context_search` tool. Numeric and enum parameters are not inspected.

### How to turn it on

Set `BRAVE_MCP_POLICY_FILE` to the absolute path of a JSON policy file before starting the server:

```sh
BRAVE_API_KEY=your_key \
BRAVE_MCP_POLICY_FILE=/etc/brave-mcp/policy.json \
npx brave-search-mcp
```

The feature is **disabled by default**. When `BRAVE_MCP_POLICY_FILE` is not set the server behaves exactly as before.

### How to switch to redaction mode

Add `BRAVE_MCP_POLICY_REDACT=true`:

```sh
BRAVE_API_KEY=your_key \
BRAVE_MCP_POLICY_FILE=/etc/brave-mcp/policy.json \
BRAVE_MCP_POLICY_REDACT=true \
npx brave-search-mcp
```

### Policy file format

The file must be valid JSON containing a top-level object with up to two optional fields:

| Field | Type | Description |
|---|---|---|
| `deniedPhrases` | `string[]` | Literal strings. A query is blocked/redacted if it contains any phrase as a case-insensitive substring. |
| `deniedPatterns` | `string[]` | Regular expression source strings. Each is compiled with the `i` (case-insensitive) flag at startup. A query is blocked/redacted if any pattern matches. |

Both fields are optional. An empty object `{}` is valid and applies no rules.

#### Sample policy file

```json
{
  "deniedPhrases": [
    "internal-secret",
    "company-confidential"
  ],
  "deniedPatterns": [
    "\\b[0-9]{3}-[0-9]{2}-[0-9]{4}\\b",
    "\\b[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}\\b"
  ]
}
```

The first two entries in `deniedPhrases` block any query containing those substrings (case-insensitive). The patterns block US Social Security Numbers and email addresses respectively.

### Error response shape

When a query is hard-blocked the tool result looks like this:

```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "[POLICY:DENIED] Query matched policy rule: \"internal-secret\""
    }
  ]
}
```

The `code` field returned by the interceptor is `POLICY_DENIED` and is available to callers that inspect the raw MCP response.

### Startup errors

If `BRAVE_MCP_POLICY_FILE` is set but the file cannot be read or contains invalid JSON, the server exits immediately with a descriptive error message on stderr:

```
Error: Failed to start server: Policy file error: could not read "/bad/path.json": ENOENT: no such file or directory, open '/bad/path.json'
```

### Environment variables summary

| Variable | Required | Default | Description |
|---|---|---|---|
| `BRAVE_MCP_POLICY_FILE` | No | _(unset — feature disabled)_ | Absolute path to the JSON policy file. |
| `BRAVE_MCP_POLICY_REDACT` | No | `false` | Set to `true` to enable redaction mode instead of hard-blocking. |
