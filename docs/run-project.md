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
- Worker health response: <http://localhost:8787>

`OPENROUTER_API_KEY` is documented now for the forthcoming OpenRouter
integration. The foundation health endpoint does not require it.

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

`npm run test` uses Node's built-in test runner until feature work adds tests.
`npm run lint` currently delegates to TypeScript typechecking; dedicated linting
will be introduced when it is needed.

## Deployment

- Build `apps/web` as static files and publish them with GitHub Pages.
- Deploy `apps/api` with Cloudflare Wrangler.
- Store `OPENROUTER_API_KEY` as a Cloudflare Worker secret.
- Configure the frontend production API base URL to point at the Worker.
