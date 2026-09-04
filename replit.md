# Hello Obfuscator

Hello Obfuscator is a browser-based Lua transformation workspace powered by the bundled Prometheus engine.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/hello-obfuscator run typecheck` — check the frontend package
- `pnpm --filter @workspace/api-server run typecheck` — check the API package

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/hello-obfuscator` — the responsive web interface and local source editor
- `artifacts/api-server/src/routes/obfuscator.ts` — preset and obfuscation API routes
- `artifacts/api-server/obfuscator-engine` — safe transformer modules from the supplied Prometheus archive
- `artifacts/api-server/src/obfuscator-engine/run.lua` — Lua runner used by the API subprocess
- `lib/api-spec/openapi.yaml` — source of truth for the obfuscator API contract

## Architecture decisions

- Uploaded Lua is parsed and transformed by Prometheus; it is never executed as user code.
- Each request runs in a fresh temporary directory with a bounded subprocess timeout and a size limit.
- The unrelated `hai.lua` and `out.lua` payload files from the supplied archive are not bundled.
- The web client uses generated OpenAPI hooks so the UI and API stay contract-aligned.

## Product

- Paste or upload Lua source into the transformation bench.
- Choose Minify, Weak, Normal, Strong, or Vmify presets.
- Select LuaU or Lua 5.1 output behavior and optional pretty printing.
- View, copy, and download the transformed `.lua` output with size and runtime metrics.

## User preferences

No additional preferences recorded.

## Gotchas

- The API requires the Lua 5.2 runtime module installed in the environment.
- After changing `lib/api-spec/openapi.yaml`, run API codegen before using updated client or server types.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
