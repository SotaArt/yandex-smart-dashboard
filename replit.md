# Умный дом Яндекс — Smart Command

Панель управления устройствами умного дома Яндекс. Инженерная панель для полного управления и пользовательская панель с настраиваемыми виджетами.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API proxy server (port 8080)
- `pnpm --filter @workspace/smart-home run dev` — run the frontend (port 22449)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (CORS proxy to Yandex IoT + Open-Meteo)
- Frontend: React + Vite, TanStack Query, Wouter, shadcn/ui, Tailwind
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/api-client-react/src/generated/` — React Query hooks (codegen)
- `lib/api-zod/src/generated/` — Zod schemas (codegen)
- `artifacts/api-server/src/routes/yandex.ts` — Yandex IoT API proxy
- `artifacts/api-server/src/routes/weather.ts` — Open-Meteo weather proxy
- `artifacts/smart-home/src/pages/engineering-panel.tsx` — Engineering panel (/)
- `artifacts/smart-home/src/pages/user-panel.tsx` — User tile dashboard (/panel)
- `artifacts/smart-home/src/hooks/` — Custom hooks (token, panel config, sensor history)
- `artifacts/smart-home/src/lib/yandex.ts` — Device type icons, helpers

## Architecture decisions

- Backend acts as a CORS proxy — all Yandex API calls go through Express, forwarding the `x-yandex-token` header as a Bearer token. No DB needed; localStorage handles all persistence.
- Yandex OAuth token stored in `localStorage` key `yandex_access_token`, persists between sessions.
- Panel tile config stored in `localStorage` key `panel_config_v3` (size, order, pinned, hidden per device).
- Sensor history stored in `localStorage` key `sensor_history` — up to 8 recent values per sensor device, used for SVG sparklines.
- Weather data fetched from Open-Meteo (free, no API key required), city name reverse-geocoded from Nominatim.

## Product

- **Engineering Panel** (`/`): Full device management — households, rooms, device cards with toggle/brightness/sensor controls, search, scenario runner, connection status.
- **User Panel** (`/panel`): iOS-style tile dashboard — weather widget, scrollable room tabs, adaptive tile grid (2-5 cols), device tiles with on/off toggle, brightness sliders, SVG sensor sparklines, edit mode with drag-and-drop reordering, pin, delete, resize.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change, run `pnpm --filter @workspace/api-spec run codegen` before touching frontend code.
- Mutation hooks (`useControlDevice`, `useRunScenario`) receive token via `request: { headers: {...} }` at hook initialization, NOT inside `mutate()` — the generated vars type doesn't include headers.
- The Yandex header is `x-yandex-token` (lowercase), always forwarded as `Authorization: Bearer <token>` to Yandex API.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
