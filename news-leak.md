# News Context Leakage Resolution

## Problem
When using the News Search widget in ChatGPT, the model was automatically receiving the full list of news articles in its context, defeating the purpose of the "Selective Article Context" feature.

**Root Cause**: The `structuredContent` field in the tool result (containing all articles) was being automatically ingested by the model because it was at the top level of the response.

## Investigation & Fixes

### 1. Hiding Data from Model
To prevent the model from seeing the data automatically, we moved the structured payload to the `_meta` field, which is designed to be "Hidden from the model" but "Delivered to the component".

**Change**:
- Modified `BraveNewsSearchTool.ts` to return:
  ```typescript
  {
    content: [{ type: 'text', text: "Summary text..." }],
    _meta: {
      structuredContent: { ... }
    }
  }
  ```

### 2. Output Validation Error
**Error**: "Tool brave_news_search has an output schema but no structured content was provided"
**Cause**: The tool was registered with `outputSchema`. The Apps SDK (or host) validates that if `outputSchema` is present, the result MUST contain `structuredContent` matching it. Since we moved it to `_meta`, validation failed.
**Fix**: Removed `outputSchema` from the tool registration in `server.ts`.

### 3. Missing Data in Widget
**Issue**: The widget appeared blank.
**Cause**: The standard `useToolOutput()` hook in the ChatGPT Apps SDK returns `toolOutput` (which corresponds to the visible `content`/`structuredContent`). Since our `structuredContent` is in `_meta`, `useToolOutput()` returned only the text summary (or empty).
**Discovery**: The `_meta` field is exposed separately via `toolResponseMetadata`.

**Fix**:
- Updated `news-chatgpt-mode.tsx` to use the `useToolResponseMetadata()` hook.
- Data is now retrieved via `metadata?.structuredContent`.

## Current Implementation

### Server-Side
- **Tool**: Returns `_meta.structuredContent` in UI mode.
- **Registration**: No `outputSchema` validation.

### Client-Side (Widget)
- **Hook**: `useToolResponseMetadata()` used to access hidden data.
- **Context Control**: Model only sees the text summary initially. Full article content is only added to context when the user explicitly interacts with the widget buttons (triggering `setWidgetState`).

## Verification
Confirmed via debug output in the ChatGPT widget:
- **Output**: Received minimal text: `"Found 10 news articles..."`
- **Metadata**: Received full structured content in `_meta`.
- **Widget**: Rendering correctly with data from metadata.
- **Model Context**: Model does not reference specific articles until added by user.
