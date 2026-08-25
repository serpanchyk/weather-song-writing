# Run Project

## Requirements

- Node.js 20 or newer
- npm

## Local Development

Install dependencies and create local environment files:

```bash
npm install
cp apps/web/.env.example apps/web/.env
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

Start the Vite frontend and Cloudflare Worker together:

```bash
npm run dev
```

- Frontend: <http://localhost:5173>
- Worker health response: <http://localhost:8787/api/v1/health>

`OPENROUTER_API_KEY` is documented now for the forthcoming OpenRouter
integration. The foundation health endpoint does not require it.

The Worker accepts browser requests from `http://localhost:5173` and
`http://127.0.0.1:5173` while `FRONTEND_ORIGIN` is unset. Set
`FRONTEND_ORIGIN` to the deployed GitHub Pages origin before production use.

Set `VITE_API_BASE_URL` in `apps/web/.env` to a deployed Worker URL when the
frontend should call a non-local API.

## Checks

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run build
```

`npm run test` uses Node's built-in test runner with `tsx` so shared TypeScript
tests can run without a separate compilation step.
`npm run lint` currently delegates to TypeScript typechecking; dedicated linting
will be introduced when it is needed.

## Deployment

- Build `apps/web` as static files and publish them with GitHub Pages.
- Deploy `apps/api` with Cloudflare Wrangler.
- Store `OPENROUTER_API_KEY` as a Cloudflare Worker secret.
- Configure the frontend production API base URL to point at the Worker.
- When run-history storage is provisioned, add its real binding to
  `apps/api/wrangler.toml`:

  ```toml
  [[d1_databases]]
  binding = "RUNS_DB"
  database_name = "weather-song-writing"
  database_id = "<Cloudflare D1 database ID>"
  ```
