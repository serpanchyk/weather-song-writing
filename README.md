# Weather Song Writing

Structure-only scaffold for a demo app that generates weather-inspired lyrics and
compares OpenRouter model outputs by quality, estimated cost, and response time.

## Demo Idea

The intended product flow is:

1. A user selects a location, local date/time, lyrics genre, language, lyrics
   structure, mood, two to six candidate OpenRouter models, and optionally a
   judge model.
2. The frontend calls a Cloudflare Worker API.
3. The Worker fetches weather data from Open-Meteo.
4. The Worker asks selected OpenRouter models to generate lyrics from the same
   structured prompt.
5. The Worker runs blind LLM-as-a-judge evaluation without exposing model
   identities to the judge.
6. The Worker combines judge scores, estimated cost, and response time into a
   visible final ranking formula.
7. The Worker saves the run in Cloudflare D1 so it can be reopened from global
   run history.

## Intended Runtime

- Frontend: static Vite + TypeScript app in `apps/web`, deployed to GitHub Pages.
- Backend: Cloudflare Worker in `apps/api`.
- Weather source: Open-Meteo geocoding, forecast, and archive APIs.
- LLM access: OpenRouter from the Worker only.
- Run history: Cloudflare D1 as SQLite-compatible storage.
- Secrets: Cloudflare Worker secrets/environment variables, never browser code.

## Planned Service Map

- `apps/web`: static frontend for GitHub Pages.
- `apps/api`: Cloudflare Worker API that keeps OpenRouter credentials
  server-side.
- `packages`: optional shared TypeScript utilities if frontend and Worker need
  shared types, schemas, or scoring constants.
- `infra`: optional deployment notes, D1 schema/migrations, service
  configuration, and environment examples.

## Planned Request Flow

GitHub Pages frontend -> Cloudflare Worker API -> Open-Meteo + OpenRouter ->
blind evaluation -> scored winner persisted -> run returned to frontend.

## Runtime Decisions

- Use Open-Meteo because the non-commercial weather API does not require an API
  key.
- Use OpenRouter because one API key can access multiple candidate models.
- Resolve available OpenRouter models through a shared model catalog interface
  used by both candidate model selection and judge model selection.
- Save completed runs so they can be browsed and reopened without user accounts.
- Use Cloudflare D1 as the SQLite-compatible storage target for saved runs.
- Keep all LLM secrets in Cloudflare Worker secrets/environment variables.
- Prioritize a working test-task demo over production-grade infrastructure.

## Open Decisions

- Exact frontend UI layout.
- Exact OpenRouter model catalog filtering, pricing metadata, and fallback
  behavior.
- Detailed result payload schemas beyond the initial API skeleton.
- CI and deployment workflow details.

## Current State

The shared contracts, Worker API skeleton, D1 run-history persistence,
server-side OpenRouter text-model catalog, and Open-Meteo weather resolution
are implemented. Deterministic candidate and blind-judge prompt construction,
generation, blind evaluation, scoring, and run persistence are also implemented.
Frontend flow, CI, and deployment configuration are still pending.
