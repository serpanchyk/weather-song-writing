# Agent Guide

## Project Purpose

This repository is a small demo app for generating weather-inspired lyrics and
comparing OpenRouter model outputs by quality, estimated cost, and response
time.

The target product flow is:

1. A user selects a location, local date/time, lyrics genre, language, lyrics
   structure, mood, two to six candidate OpenRouter models, and optionally a
   judge model.
2. The frontend calls a Cloudflare Worker API.
3. The Worker resolves weather through Open-Meteo.
4. The Worker sends the same prompt to every selected candidate model.
5. The Worker asks a judge model to score anonymous candidate outputs.
6. The Worker combines judge scores, cost estimates, and timing into a visible
   final ranking formula.
7. The Worker saves the run in Cloudflare D1 so it can be reopened from global
   run history.

## Source Of Truth

- `README.md`: repository overview and intended runtime.
- `docs/VISION.md`: product behavior, input controls, scoring, run history, and
  failure handling.
- `docs/system/README.md`: system boundaries and responsibility split.
- `CONTEXT.md`: product glossary only. Keep implementation details out of it.

When behavior, architecture, storage, scoring, API shape, or runtime setup
changes, update the relevant docs in the same change.

## Repository Boundaries

- `apps/web`: static Vite + TypeScript frontend for GitHub Pages.
- `apps/api`: Cloudflare Worker TypeScript API.
- `packages`: shared TypeScript only when real duplication appears.
- `infra`: deployment notes, D1 schema/migrations, service configuration, and
  environment examples.
- `docs`: product and system documentation.
- `mcp_servers`: do not create unless the product explicitly needs an MCP/tool
  boundary.

Do not put runtime business logic in the repo root.

## Architecture Rules

- Keep the project demo-sized. Do not add auth, queues, background workers, or
  extra services unless docs first explain the concrete need.
- Use Cloudflare D1 for saved run history. Do not introduce another database.
- Keep all OpenRouter calls and secrets server-side in the Worker.
- Browser code must call only the Worker API for privileged operations.
- Use Open-Meteo for geocoding, forecast weather, and archive weather.
- Candidate model and judge model selectors must use the same OpenRouter model
  catalog interface.
- Judge evaluation must be blind: the judge prompt can include weather summary,
  genre, language, lyrics structure, mood, and anonymous candidate outputs, but
  must not include model names, pricing, or response times.
- Cost and response time affect only the final ranking formula, not the judge
  quality scores.
- Save completed runs globally; there is no user/account separation.

## Product Constraints

- Generate lyrics text only. Do not imply audio, melody, tracks, or full songs.
- Candidate model count is two to six.
- Genre, language, lyrics structure, and mood are dropdown-style controlled
  inputs, not free text.
- Location supports city input and coordinates.
- Past dates use weather archive data; today and near-future dates use forecast
  data; unsupported dates should fail validation before generation.
- If at least two candidate models succeed, save and rank the partial run.
  Failed or timed-out models stay visible in the result table and are excluded
  from ranking.
- If fewer than two candidate models succeed, mark the run failed and skip judge
  evaluation.
- The final ranking formula must be visible to users.

## Implementation Discipline

- Prefer Worker-native TypeScript and static frontend code.
- Keep shared code small and boring. Create `packages` code only after duplication
  exists or a shared contract is clearly needed.
- Prefer typed request/response schemas at API boundaries.
- Keep external API adapters isolated from scoring and prompt-building logic.
- Avoid speculative abstractions. Build the smallest complete path that satisfies
  the documented demo.
- Use structured logging in runtime code. Do not use `print()`-style debugging in
  committed implementation.
- Keep real API keys and local secrets out of git. Track `.env.example` files for
  required configuration.

## Testing And Checks

Add or update focused tests when implementing behavior.

Minimum expected coverage once implementation starts:

- prompt construction gives every candidate the same weather and creative input
- judge payload omits model identities, pricing, and response times
- scoring formula combines quality, cost, and speed as documented
- partial failure behavior for candidate models
- D1 persistence for completed and partial runs
- API validation for model count, required inputs, and unsupported weather dates

Run the most relevant local checks before finishing. If checks cannot run because
the project is still scaffold-only or dependencies are missing, say that clearly.

## Git Hygiene

- Do not revert user changes unless explicitly asked.
- Keep generated changes scoped to the requested task.
- Commit after every completed agent-made change unless the user explicitly asks
  not to commit or the change is intentionally exploratory.
- Run Prettier before every commit and include any required formatting updates
  in that commit.
- Keep commits scoped. Do not include unrelated IDE files, local environment
  files, or user work outside the requested change.
- Before reporting completion, check `git status --short` and distinguish your
  changes from pre-existing worktree state.

## Completion Reports

When making changes, report:

- what changed
- checks run
- docs updated
- assumptions, missing secrets, or manual setup still required
