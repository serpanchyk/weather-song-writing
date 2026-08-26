# System Overview

## Intended Architecture

The project is planned as a small static frontend plus serverless API:

```text
GitHub Pages frontend
  -> Cloudflare Worker API
  -> Open-Meteo weather APIs
  -> OpenRouter chat completions
  -> blind LLM judging and weighted scoring
  -> Cloudflare D1 run storage
```

## Frontend Responsibility

The static frontend handles user input and result display:

- city search
- date/time selection
- genre and language selection
- candidate model selection from the OpenRouter model catalog
- judge model selection with a recommended default
- global previous run browsing and reopening
- loading and error states
- weather summary, generated lyrics, scores, costs, and winner display

## Worker Responsibility

The future Worker should own all external API calls and secrets:

- resolve cities through Open-Meteo geocoding
- fetch forecast or archive weather data
- expose available OpenRouter models for candidate and judge selection
- build one structured prompt from weather data
- call selected OpenRouter models
- evaluate each successful candidate as soon as it is generated and omit its
  model identity from the judge prompt
- include weather summary, genre, language, lyrics structure, mood, and one
  anonymous candidate output in each judge prompt
- exclude model names, pricing, and response times from the judge prompt
- emit live comparison updates, compute provisional weighted scores, and return
  the final persisted result
- save completed runs and expose previous runs to the frontend

## Initial API Surface

The Worker exposes a versioned JSON API at `/api/v1`:

- `GET /health` for smoke testing
- `GET /models` for the forthcoming OpenRouter catalog
- `POST /runs` for validated generation requests
- `GET /runs` for cursor-paginated global history and `GET /runs/:id` for a
  saved run detail

All listed routes are active. Run creation validates input, resolves weather,
generates candidate outputs, evaluates them blindly, ranks them, and persists
the resulting run. Invalid input returns a structured `400` validation response.

## Data Sources

- Open-Meteo: geocoding, forecast, and archive weather data.
- OpenRouter: candidate lyric generation and judge model.
- Cloudflare D1: SQLite-compatible saved run history.

## Security Boundary

OpenRouter keys must never be exposed to the browser. Browser code should only
call the Cloudflare Worker API.
