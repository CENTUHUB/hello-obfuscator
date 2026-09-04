# Hello Obfuscator

Complete source for the Hello Obfuscator web app.

This export contains:

- `artifacts/hello-obfuscator` — React/Vite browser interface
- `artifacts/api-server` — Express API and bundled Prometheus Lua transformer
- `lib/api-spec` — OpenAPI source of truth
- `lib/api-client-react` — generated React API hooks
- `lib/api-zod` — generated server validation schemas
- `pnpm-lock.yaml` — locked JavaScript dependencies

Generated dependencies, build output, Replit-only metadata, local secrets, and
the unrelated payload files from the original archive are intentionally not
included.

## Requirements

- Node.js 20.19+ (Node.js 22+ recommended)
- pnpm 10+
- A Lua 5.2-compatible executable named `lua` on `PATH`

The API invokes `lua` to run the transformer. A static-only hosting provider
cannot run this application; use a host that can run a Node.js server and
install system packages, such as a VPS or a container-capable platform.

## Install

```bash
pnpm install
```

Install Lua 5.2 using your host's package manager. For Debian/Ubuntu, the
package is commonly named `lua5.2`; make sure the resulting executable is
available as `lua`:

```bash
sudo apt-get update
sudo apt-get install -y lua5.2
sudo update-alternatives --install /usr/bin/lua lua-interpreter /usr/bin/lua5.2 20
```

Check both runtimes:

```bash
node --version
pnpm --version
lua -v
```

## Development

Run the API and frontend in separate terminals:

```bash
# Terminal 1
PORT=5000 pnpm --filter @workspace/api-server run dev

# Terminal 2
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/hello-obfuscator run dev
```

Open `http://localhost:3000`.

The frontend calls the API at `/api`, so local development and production
should route `/api/*` to the API server.

## Production build

Build both parts:

```bash
pnpm --filter @workspace/api-server run build
BASE_PATH=/ PORT=3000 pnpm --filter @workspace/hello-obfuscator run build
```

Start the API:

```bash
PORT=5000 pnpm --filter @workspace/api-server run start
```

Serve the static frontend directory
`artifacts/hello-obfuscator/dist/public` with your web server. Configure the
same web server to:

1. Serve the frontend for `/` and client routes.
2. Proxy `/api/*` to `http://127.0.0.1:5000`.

For a single-domain deployment, this reverse-proxy step is required because
the browser client intentionally uses same-origin `/api` requests.

## API endpoints

- `GET /api/health`
- `GET /api/obfuscator/presets`
- `POST /api/obfuscator/obfuscate`

The obfuscation endpoint accepts JSON with `source`, `preset`,
`luaVersion` (optional), `prettyPrint` (optional), and `fileName` (optional).
Source input is limited to 256 KB and each Lua subprocess is limited to 20
seconds.

## Safety boundary

Submitted Lua is parsed and transformed; it is never executed as user code.
The server bundles only the transformer modules needed by Prometheus. Each
request uses a temporary working directory that is removed after completion.