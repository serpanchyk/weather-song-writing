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
`http://127.0.0.1:5173` while `FRONTEND_ORIGIN` is unset. Local
`OPENROUTER_API_KEY` belongs only in `apps/api/.dev.vars`; it must never be
placed in `apps/web/.env`.

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

## Production Deployment

The public frontend is deployed by GitHub Actions from `main` to
<https://serpanchyk.github.io/weather-song-writing/>. Its build is configured
with the Worker API URL:

<https://weather-song-writing-api.anton-mykhalchuk-ua.workers.dev>

The Worker configuration includes the production D1 binding and allows the
GitHub Pages origin. It is deployed by the same workflow after validation.

Before the first automated Worker deployment, add the following GitHub Actions
repository secret:

- `CLOUDFLARE_API_TOKEN`: a least-privilege Cloudflare API token able to deploy
  this Worker. Do not store the OpenRouter key in GitHub.

After the Worker exists, set the live generation key directly in Cloudflare:

```bash
cd apps/api
npx wrangler secret put OPENROUTER_API_KEY
```

The production D1 database is named `weather-song-writing`. Its run-history
migration is in `infra/d1/migrations/0001_run_history.sql` and is applied once
during provisioning. To apply it again to another database, run:

```bash
cd apps/api
npx wrangler d1 execute weather-song-writing --remote --file=../../infra/d1/migrations/0001_run_history.sql
```

For a local Worker database, omit `--remote`. The Worker expects the `RUNS_DB`
binding before calling either history endpoint.

## Production Smoke Check

1. Request `GET /api/v1/health` from the Worker URL.
2. Open the GitHub Pages URL and confirm the model catalog loads.
3. Submit a run with two candidate models and confirm the ranked result appears.
4. Reopen the saved run from history.
5. Confirm no browser source, committed file, or GitHub secret contains
   `OPENROUTER_API_KEY`.
