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

**User Testing (2026-01-23):**
- When asked to "list the articles", model initially attempted to guess/hallucinate article titles.
- When explicitly asked "do you have the articles in your context?", model confirmed it does **NOT** have them.
- ✅ **Context leakage is fixed.** Model only sees summary text, not article details.

## All Code Paths Now Use `_meta`
All three handlers in `BraveNewsSearchTool.ts` now consistently use `_meta.structuredContent`:
1. **Success path** (normal results)
2. **No results path** (empty search)
3. **Error path** (API failures)

## Prompt Engineering Fix (2026-01-23)
The model was hallucinating article summaries despite not having access. Fixed by updating the tool response text to be explicit:

```
Found X news articles for "query".
IMPORTANT: You CANNOT see the article titles, sources, or content.
The user sees a widget with the articles, but you have NO information about them.
Do NOT claim to see headlines or describe what the articles are about.
Simply tell the user the articles are displayed in the widget and wait for them to share details.
```

**Result:** Model now correctly responds with:
- "I can't see the headlines or details yet"
- "Click the '+' icon on any article to add it to the conversation"
- "Once you do that, I can summarize/explain/compare..."

Example response:
> "I've pulled up recent news articles about orange cats and they're now displayed for you in the news widget above. I can't see the article titles or contents yet. If you click the '+' icon on any article that looks interesting, it'll add that article into our conversation. Once you do that, I can summarize the article, explain why it's getting attention, or help you dig into any details."
