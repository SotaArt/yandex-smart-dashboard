---
name: Yandex non-JSON error bodies
description: Yandex API can return HTML or non-JSON on some error conditions — never call response.json() directly.
---

## Rule
Always use a `safeJson(response)` helper that reads `response.text()` first and wraps `JSON.parse` in try/catch, returning `null` on failure. Check `!response.ok` before attempting Zod parse.

**Why:** The scenarios endpoint (`/v1.0/scenarios`) returns a non-JSON body under certain error conditions. Calling `.json()` directly throws a SyntaxError that bypasses our error handling and crashes the route with an unhandled 502, logging a confusing stack trace.

**How to apply:** All Yandex proxy routes in `artifacts/api-server/src/routes/yandex.ts` should use `safeJson()`. For non-critical endpoints (e.g. scenarios), fall back to an empty list on Zod parse failure rather than returning 502.
