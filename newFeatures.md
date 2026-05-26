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

## Audit Logging And Justification Enforcement

Operators can now enable structured audit events for every MCP tool invocation and optionally require callers to provide a business reason for each request. This works in both stdio mode and Streamable HTTP mode.

### What it does

- **Structured audit events:** When enabled, the server writes one JSON line to `stderr` after every tool call. Each event records the tool name, whether the call succeeded, failed, or was denied, whether it was a local-to-web fallback, and whether `query`, `url`, or `justification` were present.
- **Safe-by-default logging:** Raw `query`, `url`, and `justification` values are not logged unless explicitly requested. By default the audit event includes SHA-256 hashes and field lengths instead.
- **Optional justification enforcement:** When enabled, every tool call must include a non-empty `justification` string. Requests that omit it, or provide only whitespace, are denied before the Brave API is called.
- **Shared tool support:** Every tool now accepts an optional `justification` field. If `brave_local_search` falls back to `brave_web_search`, the same justification is preserved on the fallback call.

### How to turn on audit logging

Set `BRAVE_MCP_AUDIT_LOG=true` before starting the server:

```sh
BRAVE_API_KEY=your_key \
BRAVE_MCP_AUDIT_LOG=true \
npx brave-search-mcp
```

Audit events are written to `stderr`, not `stdout`, so stdio MCP traffic stays intact.

### How to log raw inputs instead of hashes

Add `BRAVE_MCP_AUDIT_LOG_RAW=true`:

```sh
BRAVE_API_KEY=your_key \
BRAVE_MCP_AUDIT_LOG=true \
BRAVE_MCP_AUDIT_LOG_RAW=true \
npx brave-search-mcp
```

Use this only when operators explicitly need human-readable request payloads in the process logs.

### How to require justification

Add `BRAVE_MCP_REQUIRE_JUSTIFICATION=true`:

```sh
BRAVE_API_KEY=your_key \
BRAVE_MCP_AUDIT_LOG=true \
BRAVE_MCP_REQUIRE_JUSTIFICATION=true \
npx brave-search-mcp
```

When enforcement is enabled, every tool accepts the same additional request field:

```json
{
  "query": "test query",
  "justification": "User requested a web search"
}
```

Justification enforcement is independent of audit logging. Denied requests return a structured error to the caller but no audit events are written to `stderr` unless `BRAVE_MCP_AUDIT_LOG=true` is also set.

> **Interceptor ordering note:** Interceptors run in the order policy → guardrail → audit. A request that is rejected by the query policy layer or the usage guardrail never reaches the justification gate. This means a policy-blocked query does not need a justification — it is rejected on stronger grounds first.

### Representative success event

```json
{
  "schemaVersion": "1",
  "timestamp": "2026-05-26T18:11:23.124Z",
  "toolName": "brave_web_search",
  "outcome": "success",
  "isFallback": false,
  "durationMs": 0,
  "hasQuery": true,
  "queryHash": "050579eeae87a0436e1ff56d7a8388c2ee9b71b5f9170eb7aaaec1bcb405ca12",
  "queryLength": 10,
  "hasUrl": false,
  "justificationProvided": true,
  "justificationHash": "846c3fca0a9e2ed04fd7d44490acac0f169019789fe041d22d1199a79679c2a4",
  "justificationLength": 27,
  "wasRedacted": false
}
```

### Representative denial event

```json
{
  "schemaVersion": "1",
  "timestamp": "2026-05-26T18:11:23.121Z",
  "toolName": "brave_web_search",
  "outcome": "denied",
  "isFallback": false,
  "durationMs": 0,
  "hasQuery": true,
  "queryHash": "050579eeae87a0436e1ff56d7a8388c2ee9b71b5f9170eb7aaaec1bcb405ca12",
  "queryLength": 10,
  "hasUrl": false,
  "justificationProvided": false,
  "wasRedacted": false,
  "denyCode": "JUSTIFICATION_REQUIRED",
  "denyReason": "A non-empty justification is required"
}
```

### Environment variables summary

| Variable | Required | Default | Description |
|---|---|---|---|
| `BRAVE_MCP_AUDIT_LOG` | No | `false` | Set to `true` to emit one audit JSON line to `stderr` after each tool call. |
| `BRAVE_MCP_AUDIT_LOG_RAW` | No | `false` | Set to `true` to log raw `query`, `url`, and `justification` text instead of hashes. Has no effect unless `BRAVE_MCP_AUDIT_LOG=true` is also set. |
| `BRAVE_MCP_REQUIRE_JUSTIFICATION` | No | `false` | Set to `true` to deny any tool call whose `justification` is missing or blank after trimming. This currently also enables audit-event emission to `stderr` even if `BRAVE_MCP_AUDIT_LOG` is unset. |
