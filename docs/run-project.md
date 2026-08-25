# Run Project

Runtime commands are not implemented yet. This file records the intended future
developer workflow.

## Planned Local Workflow

```bash
npm install
npm run dev
```

The future frontend should run locally through Vite. The future Worker should run
through Wrangler.

## Planned Deployment

- Build `apps/web` as static files and publish them with GitHub Pages.
- Deploy `apps/api` with Cloudflare Wrangler.
- Store `OPENROUTER_API_KEY` as a Cloudflare Worker secret.
- Configure the frontend production API base URL to point at the Worker.

## Not Implemented Yet

- package scripts
- Vite project
- Worker project
- tests
- CI
- deployment workflows

